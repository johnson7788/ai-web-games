export const ITEM_RULES = {
  firstDrop: 6,
  dropInterval: 12,
  dropCount: 2,
  maxItems: 4,
  spawnY: 14,
  pickupDelay: 0.6,
  pickupRadius: 1,
  minDropRadius: 2,
  maxDropRadius: 6,
  maxFlyingBombs: 1,
};

export const ITEMS = {
  fish: { weight: 30, uses: 3, move: 'fish' },
  hammer: { weight: 22, uses: 2, move: 'hammer' },
  bomb: {
    weight: 22,
    uses: 1,
    fuse: 1.2,
    selfScale: 0.7,
    throwSpeed: 5,
    throwLift: 6.5,
    gravity: -12,
  },
  glove: { weight: 20, uses: 1, duration: 30, knockMultiplier: 1.5 },
  star: { weight: 6, uses: 1, duration: 8, speedMultiplier: 1.2, knockMultiplier: 1.3 },
};
