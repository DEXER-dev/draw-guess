// 统计题库里会被 wordMatch 的“编辑距离 ≤1 / 单复数”容错判为同题的英文词对。
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORD_BANK, WORD_ALIASES } from '../../words.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packDir = path.resolve(__dirname, '..', '..', 'data', 'word-packs');

const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_'".!?，。！？、：:；;·]+/g, '');
function lev(a, b) {
  const m = a.length; const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[m][n];
}

const words = [];
for (const group of WORD_BANK) for (const item of group.words) words.push(item.word);
try {
  for (const file of await readdir(packDir)) {
    if (!file.endsWith('.json') || file === 'manifest.json') continue;
    const json = JSON.parse(await readFile(path.join(packDir, file), 'utf8'));
    for (const group of json.groups || []) for (const item of group.words || []) words.push(typeof item === 'string' ? item : item.word);
  }
} catch (e) { console.log('词库目录跳过：', e.message); }

const en = [...new Set(words.map(norm).filter((w) => /^[a-z]+$/.test(w) && w.length >= 5))];
const aliases = [...new Set(Object.values(WORD_ALIASES || {}).flat().map(norm).filter((w) => /^[a-z]+$/.test(w) && w.length >= 5))];
const keyOf = (w) => words.find((x) => norm(x) === w) || w;

const dupes = [];
for (let i = 0; i < en.length; i += 1) {
  for (let j = i + 1; j < en.length; j += 1) {
    const a = en[i]; const b = en[j];
    if (a === `${b}s` || b === `${a}s`) dupes.push([keyOf(a), keyOf(b), '单复数']);
    else if (lev(a, b) <= 1) dupes.push([keyOf(a), keyOf(b), `距离1`]);
  }
}
const aliasClash = [];
for (const a of en) for (const b of aliases) {
  if (a !== b && (lev(a, b) <= 1 || a === `${b}s` || b === `${a}s`)) aliasClash.push([keyOf(a), b]);
}
console.log(`英文题库词（≥5 字母）共 ${en.length} 个`);
console.log(`互相可误判的题库词对：${dupes.length}`);
for (const [a, b, why] of dupes.slice(0, 40)) console.log(`  ${a} ↔ ${b} (${why})`);
console.log(`题库词与别名冲突：${aliasClash.length}`);
for (const [a, b] of aliasClash.slice(0, 20)) console.log(`  ${a} ≈ 别名 ${b}`);
