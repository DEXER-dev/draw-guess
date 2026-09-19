import { existsSync, mkdirSync, readFileSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const WORD_PACK_DIR = path.join(__dirname, 'data', 'word-packs');
const MANIFEST_PATH = path.join(WORD_PACK_DIR, 'manifest.json');
const SCHEMA_VERSION = 1;
const MAX_PACK_BYTES = 2 * 1024 * 1024;
const ID_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
const FILE_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}\.json$/i;

let activeRegistry = Object.freeze({
  generation: 0,
  loadedAt: 0,
  packs: new Map(),
  errors: [],
});
let watcher = null;
let reloadTimer = null;

function fail(message) {
  throw new Error(message);
}

function boundedString(value, field, max, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) fail(`${field} 不能为空`);
  if (text.length > max) fail(`${field} 不能超过 ${max} 个字符`);
  return text;
}

function validId(value, field) {
  const id = boundedString(value, field, 32, true);
  if (!ID_PATTERN.test(id)) fail(`${field} 格式不正确`);
  return id;
}

function integerInRange(value, field, min, max, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    fail(`${field} 必须是 ${min}-${max} 的整数`);
  }
  return number;
}

function normalizeEntry(rawEntry, group, entryIndex) {
  const source = typeof rawEntry === 'string' ? { word: rawEntry } : (rawEntry || {});
  const word = boundedString(source.word, `题目 ${entryIndex + 1}`, 60, true);
  const aliases = Array.isArray(source.aliases)
    ? [...new Set(source.aliases.map((alias) => boundedString(alias, '别名', 60)).filter(Boolean))]
    : [];
  return {
    id: boundedString(source.id, '题目 ID', 64) || `${group.id}-${entryIndex + 1}`,
    word,
    aliases,
    hint: boundedString(source.hint, '题目提示', 200),
    category: boundedString(source.category, '题目分类', 40) || group.category,
    clue: boundedString(source.clue, '分类提示', 200) || group.clue,
    difficulty: integerInRange(source.difficulty, '题目难度', 1, 3, group.difficulty),
    drawability: integerInRange(source.drawability, '题目可画性', 1, 5, group.drawability),
  };
}

function normalizeGroup(rawGroup, groupIndex) {
  const source = rawGroup || {};
  const id = validId(source.id || `group-${groupIndex + 1}`, '分类 ID');
  const group = {
    id,
    category: boundedString(source.category, '分类名称', 40, true),
    clue: boundedString(source.clue, '分类提示', 200, true),
    difficulty: integerInRange(source.difficulty, '分类难度', 1, 3, 2),
    drawability: integerInRange(source.drawability, '分类可画性', 1, 5, 3),
  };
  const entries = Array.isArray(source.entries) ? source.entries : source.words;
  if (!Array.isArray(entries) || entries.length === 0) fail(`${id} 必须包含非空 entries 或 words`);
  const seen = new Set();
  group.words = entries.map((entry, index) => {
    const normalized = normalizeEntry(entry, group, index);
    const key = normalized.word.toLocaleLowerCase();
    if (seen.has(key)) fail(`${id} 存在重复题目：${normalized.word}`);
    seen.add(key);
    return normalized;
  });
  return group;
}

function normalizePack(rawPack, manifestEntry) {
  if (!rawPack || rawPack.schemaVersion !== SCHEMA_VERSION) {
    fail(`schemaVersion 必须为 ${SCHEMA_VERSION}`);
  }
  const id = validId(rawPack.id || manifestEntry.id, '词库 ID');
  if (manifestEntry.id && id !== manifestEntry.id) fail(`manifest 与词库 ID 不一致：${id}`);
  const groups = Array.isArray(rawPack.groups)
    ? rawPack.groups
    : [{
        id: 'all',
        category: rawPack.category || rawPack.name,
        clue: rawPack.clue || rawPack.description || rawPack.name,
        words: rawPack.entries || rawPack.words,
      }];
  const normalizedGroups = groups.map(normalizeGroup);
  const count = normalizedGroups.reduce((sum, group) => sum + group.words.length, 0);
  if (count < 1) fail('词库至少需要 1 道题');
  return Object.freeze({
    id,
    name: boundedString(rawPack.name, '词库名称', 60, true),
    version: boundedString(rawPack.version, '词库版本', 40, true),
    locale: boundedString(rawPack.locale || 'zh-CN', '词库语言', 20, true),
    description: boundedString(rawPack.description, '词库说明', 200),
    groups: normalizedGroups,
    count,
    enabledByDefault: Boolean(manifestEntry.enabledByDefault ?? rawPack.enabledByDefault),
    file: manifestEntry.file,
  });
}

function readJsonFile(file, label) {
  if (!existsSync(file)) fail(`${label} 不存在`);
  const size = readFileSync(file).byteLength;
  if (size > MAX_PACK_BYTES) fail(`${label} 超过 ${MAX_PACK_BYTES} 字节限制`);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${label} JSON 无法解析：${error.message}`);
  }
}

function buildRegistry() {
  const manifest = readJsonFile(MANIFEST_PATH, '词库 manifest.json');
  if (!manifest || manifest.schemaVersion !== SCHEMA_VERSION) {
    fail(`manifest schemaVersion 必须为 ${SCHEMA_VERSION}`);
  }
  if (!Array.isArray(manifest.packs) || manifest.packs.length === 0) {
    fail('manifest.packs 不能为空');
  }
  const packs = new Map();
  for (const item of manifest.packs) {
    const id = validId(item?.id, 'manifest 词库 ID');
    const file = boundedString(item?.file, `${id} 文件名`, 70, true);
    if (!FILE_PATTERN.test(file) || file.includes('..')) fail(`${id} 文件名不安全`);
    if (packs.has(id)) fail(`manifest 存在重复词库：${id}`);
    const filePath = path.resolve(WORD_PACK_DIR, file);
    if (!filePath.startsWith(`${path.resolve(WORD_PACK_DIR)}${path.sep}`)) fail(`${id} 文件路径越界`);
    packs.set(id, normalizePack(readJsonFile(filePath, file), { id, file, enabledByDefault: item.enabledByDefault }));
  }
  return packs;
}

export function reloadWordPacks(reason = 'manual') {
  try {
    mkdirSync(WORD_PACK_DIR, { recursive: true });
    const packs = buildRegistry();
    activeRegistry = Object.freeze({
      generation: activeRegistry.generation + 1,
      loadedAt: Date.now(),
      packs,
      errors: [],
    });
    return { ok: true, reason, generation: activeRegistry.generation, packCount: packs.size, errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    activeRegistry = Object.freeze({ ...activeRegistry, errors: [message] });
    return { ok: false, reason, generation: activeRegistry.generation, packCount: activeRegistry.packs.size, errors: [message] };
  }
}

export function getWordPackRegistry() {
  return activeRegistry;
}

export function getWordPackCatalog() {
  return {
    generation: activeRegistry.generation,
    loadedAt: activeRegistry.loadedAt,
    errors: [...activeRegistry.errors],
    packs: [...activeRegistry.packs.values()].map((pack) => ({
      id: pack.id,
      name: pack.name,
      version: pack.version,
      locale: pack.locale,
      description: pack.description,
      count: pack.count,
      enabledByDefault: pack.enabledByDefault,
    })),
  };
}

export function startWordPackWatcher() {
  if (watcher) return;
  mkdirSync(WORD_PACK_DIR, { recursive: true });
  watcher = watch(WORD_PACK_DIR, { persistent: false }, (_eventType, filename) => {
    const name = String(filename || '');
    if (!name || !name.toLowerCase().endsWith('.json')) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      const result = reloadWordPacks('watch');
      if (result.ok) {
        console.log(`  📚 词库热读取完成：${result.packCount} 个词库，版本 ${result.generation}`);
      } else {
        console.warn(`  ⚠️ 词库热读取失败，继续使用版本 ${result.generation}：${result.errors.join('；')}`);
      }
    }, 250);
  });
  watcher.on('error', (error) => {
    console.warn(`  ⚠️ 词库目录监听失败：${error.message}`);
  });
}

reloadWordPacks('startup');
