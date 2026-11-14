// 关卡词库：每关一组字母 + 可由这些字母拼出的目标词（全部为有效英文词）。
// 玩家拖动字母环拼词，命中目标词即揭示。词按长度升序展示。
// 难度曲线：3 字母 → 4 字母 → 5 字母；目标词 3 → 8 个。
export const LEVELS = [
  { letters: 'CAT',   words: ['CAT', 'ACT', 'AT'] },
  { letters: 'EAT',   words: ['EAT', 'TEA', 'ATE', 'AT'] },
  { letters: 'ART',   words: ['ART', 'RAT', 'TAR', 'AT'] },
  { letters: 'ONE',   words: ['ONE', 'EON', 'ON', 'NO'] },
  { letters: 'SPIN',  words: ['SPIN', 'PINS', 'SNIP', 'NIPS', 'PIN', 'NIP', 'SIN', 'SIP'] },
  { letters: 'EARS',  words: ['EARS', 'SEAR', 'ERAS', 'EAR', 'ERA', 'SEA', 'ARE'] },
  { letters: 'LATE',  words: ['LATE', 'TALE', 'TEAL', 'ATE', 'EAT', 'TEA', 'ALE', 'LET'] },
  { letters: 'RATE',  words: ['RATE', 'TEAR', 'TARE', 'ART', 'EAR', 'ERA', 'EAT', 'TEA'] },
  { letters: 'RACE',  words: ['RACE', 'CARE', 'ACRE', 'ACE', 'ARC', 'CAR', 'EAR', 'ERA'] },
  { letters: 'SORT',  words: ['SORT', 'ROTS', 'ROT', 'TOR', 'SOT', 'ORT'] },
  { letters: 'TINE',  words: ['TINE', 'NITE', 'TIN', 'TIE', 'NIT', 'NET', 'TEN', 'IN'] },
  { letters: 'LEAP',  words: ['LEAP', 'PALE', 'PLEA', 'ALE', 'LAP', 'PAL', 'PEA', 'APE'] },
  { letters: 'EAST',  words: ['EAST', 'SEAT', 'EATS', 'ATE', 'EAT', 'TEA', 'SEA', 'SAT'] },
  { letters: 'STAR',  words: ['STAR', 'RATS', 'ARTS', 'TARS', 'ART', 'RAT', 'TAR', 'SAT'] },
  { letters: 'STARE', words: ['STARE', 'TEARS', 'RATES', 'TARES', 'ASTER', 'EAR', 'ERA', 'ARE'] },
  { letters: 'SPARE', words: ['SPARE', 'PEARS', 'SPEAR', 'PARES', 'REAPS', 'PEAR', 'REAP', 'RASP'] },
];

// 目标词排序：长度升序，同长按字母序，便于面板整齐展示。
export function sortedWords(words) {
  return [...words].sort((a, b) => (a.length - b.length) || a.localeCompare(b));
}