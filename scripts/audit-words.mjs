import { WORD_BANK, WORD_ALIASES } from '../words.js';
import { getWordPackRegistry } from '../word-packs.js';

const externalPacks = [...getWordPackRegistry().packs.values()];
const externalEntries = externalPacks.flatMap((pack) => pack.groups.flatMap((group) => group.words.map((entry) => ({
  ...entry,
  category: group.category,
}))));

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[\s\-_.'"!?，。！？、：:；;·]+/g, '');

const baseEntries = WORD_BANK.flatMap((group) => (group.words || []).map((entry) => ({
  ...(typeof entry === 'string' ? { word: entry } : entry),
  category: group.category,
  groupClue: group.clue,
})));
const packEntries = [
  ...baseEntries,
  ...externalEntries,
];

const duplicates = [];
const seen = new Map();
for (const entry of packEntries) {
  const key = normalize(entry.word);
  if (!key) continue;
  if (seen.has(key)) duplicates.push(`${seen.get(key)} = ${entry.word}`);
  else seen.set(key, entry.word);
}

const missingMetadata = baseEntries
  .filter((entry) => !entry.word || ![1, 2, 3].includes(entry.difficulty) || ![1, 2, 3, 4, 5].includes(entry.drawability))
  .map((entry) => `${entry.category}:${entry.word || '(empty)'}`);
const nonMediumEntries = baseEntries
  .filter((entry) => entry.difficulty !== 2)
  .map((entry) => `${entry.category}:${entry.word}`);
const invalidLengthEntries = baseEntries
  .filter((entry) => {
    const length = Array.from(String(entry.word || '').replace(/\s/g, '')).length;
    return length < 2 || length > 6;
  })
  .map((entry) => `${entry.category}:${entry.word}`);
const nonFourCharIdiomEntries = baseEntries
  .filter((entry) => entry.category === '成语')
  .filter((entry) => Array.from(String(entry.word || '').replace(/\s/g, '')).length !== 4)
  .map((entry) => `${entry.category}:${entry.word}`);
const openEndedEntries = baseEntries
  .filter((entry) => /[\s，。！？；：]/.test(entry.word))
  .map((entry) => `${entry.category}:${entry.word}`);
const ambiguousWordPatterns = [/东西/u, /捡物/u, /^打手势$/u, /^伸手$/u];
const ambiguousEntries = baseEntries
  .filter((entry) => ambiguousWordPatterns.some((pattern) => pattern.test(entry.word)))
  .map((entry) => `${entry.category}:${entry.word}`);
const missingClues = WORD_BANK
  .filter((group) => !String(group.clue || '').trim())
  .map((group) => group.category);
const activeWords = new Set(packEntries.map((entry) => entry.word));
const inactiveAliases = Object.keys(WORD_ALIASES).filter((word) => !activeWords.has(word));

const counts = {};
for (const entry of baseEntries) counts[entry.category] = (counts[entry.category] || 0) + 1;

console.log(`基础题 ${baseEntries.length} 条；外部词库题 ${externalEntries.length} 条；总计 ${packEntries.length} 条`);
console.log(`类别：${Object.entries(counts).map(([category, count]) => `${category} ${count}`).join(' / ')}`);
console.log(`难度：中等 ${baseEntries.filter((entry) => entry.difficulty === 2).length} 条`);

if (duplicates.length || missingMetadata.length || nonMediumEntries.length || invalidLengthEntries.length || nonFourCharIdiomEntries.length || openEndedEntries.length || ambiguousEntries.length || missingClues.length || inactiveAliases.length) {
  if (duplicates.length) console.error(`重复题目：${duplicates.join('、')}`);
  if (missingMetadata.length) console.error(`缺少元数据：${missingMetadata.join('、')}`);
  if (nonMediumEntries.length) console.error(`非中等难度题目：${nonMediumEntries.join('、')}`);
  if (invalidLengthEntries.length) console.error(`长度不在 2-6 字：${invalidLengthEntries.join('、')}`);
  if (nonFourCharIdiomEntries.length) console.error(`成语分类含非四字题目：${nonFourCharIdiomEntries.join('、')}`);
  if (openEndedEntries.length) console.error(`疑似开放式句子：${openEndedEntries.join('、')}`);
  if (ambiguousEntries.length) console.error(`高歧义泛化题目：${ambiguousEntries.join('、')}`);
  if (missingClues.length) console.error(`缺少类别提示：${missingClues.join('、')}`);
  if (inactiveAliases.length) console.error(`别名指向不存在的题目：${inactiveAliases.join('、')}`);
  process.exitCode = 1;
}
