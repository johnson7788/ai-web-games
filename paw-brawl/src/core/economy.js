export const CHARACTER_PRICES = Object.freeze({
  bear: 300,
  fox: 600,
  frog: 900,
  duck: 1200,
});

export function calculateCoins({ rank, kos = 0, wins = 0 } = {}) {
  const rankCoins = rank === 1 ? 120 : rank === 2 ? 80 : rank === 3 ? 50 : 25;
  const validKos = Number.isFinite(kos) ? Math.max(0, Math.floor(kos)) : 0;
  const breakdown = {
    rank: rankCoins,
    kos: validKos * 15,
    firstWin: rank === 1 && wins === 0 ? 100 : 0,
    champion: rank === 1 ? 50 : 0,
  };
  const total = breakdown.rank + breakdown.kos + breakdown.firstWin + breakdown.champion;
  return { total, breakdown };
}

export function calculateTeamCoins({ won = false, kos = 0 } = {}) {
  const validKos = Number.isFinite(kos) ? Math.max(0, Math.floor(kos)) : 0;
  const breakdown = { rank: won ? 150 : 40, kos: validKos * 15, firstWin: 0, champion: 0 };
  return { total: breakdown.rank + breakdown.kos, breakdown };
}

// 不可变：成功时返回新存档；失败时返回原存档且金币不变。
export function unlockCharacter(save, charId) {
  if (!save || !Array.isArray(save.unlocked) || save.unlocked.includes(charId)) return save;
  if (!Object.hasOwn(CHARACTER_PRICES, charId)) return save;
  const price = CHARACTER_PRICES[charId];
  if (!Number.isFinite(save.coins) || save.coins < price) return save;
  return {
    ...save,
    coins: save.coins - price,
    unlocked: [...save.unlocked, charId],
  };
}

export function canStart(save, charId) {
  return Array.isArray(save?.unlocked) && save.unlocked.includes(charId);
}
