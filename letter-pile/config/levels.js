// 字母堆关卡：一组字母 + 可由其拼出的目标词列表。
export const LEVELS = [
  { letters: 'CAT', words: ['CAT', 'ACT', 'AT'] },
  { letters: 'EAT', words: ['EAT', 'TEA', 'ATE', 'AT'] },
  { letters: 'ART', words: ['ART', 'RAT', 'TAR', 'AT'] },
  { letters: 'ONE', words: ['ONE', 'EON', 'ON', 'NO'] },
  { letters: 'SPIN', words: ['SPIN', 'PINS', 'SNIP', 'PIN', 'NIP', 'SIN', 'SIP'] },
  { letters: 'EARS', words: ['EARS', 'SEAR', 'ERAS', 'EAR', 'ERA', 'SEA', 'ARE'] },
  { letters: 'LATE', words: ['LATE', 'TALE', 'TEAL', 'ATE', 'EAT', 'TEA', 'ALE', 'LET'] },
  { letters: 'RATE', words: ['RATE', 'TEAR', 'TARE', 'ART', 'EAR', 'ERA', 'EAT', 'TEA'] },
  { letters: 'RACE', words: ['RACE', 'CARE', 'ACRE', 'ACE', 'ARC', 'CAR', 'EAR', 'ERA'] },
  { letters: 'STAR', words: ['STAR', 'RATS', 'ARTS', 'TARS', 'ART', 'RAT', 'TAR', 'SAT'] },
  { letters: 'STARE', words: ['STARE', 'TEARS', 'RATES', 'TARES', 'ASTER', 'EAR', 'ERA', 'ARE'] },
  { letters: 'SPARE', words: ['SPARE', 'PEARS', 'SPEAR', 'PARES', 'REAPS', 'PEAR', 'REAP', 'RASP'] },
];

export function sortedWords(words) {
  return [...words].sort((a, b) => (a.length - b.length) || a.localeCompare(b));
}

export const LEVEL_COUNT = LEVELS.length;