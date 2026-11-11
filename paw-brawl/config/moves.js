export const MOVES = {
  punch1: { startup: 0.10, active: 0.07, recovery: 0.16, knock: 6.5, poise: 14, range: 1.7, arc: 100, lunge: 0.5, sfx: 'punchLight', next: 'punch2' },
  punch2: { startup: 0.08, active: 0.07, recovery: 0.16, knock: 7.5, poise: 14, range: 1.7, arc: 100, lunge: 0.6, sfx: 'punchLight', next: 'punch3' },
  punch3: { startup: 0.16, active: 0.09, recovery: 0.30, knock: 12, poise: 28, range: 1.85, arc: 110, lunge: 0.9, sfx: 'punchHeavy' },
  charged: { startup: 0.10, active: 0.10, recovery: 0.35, knock: 22, poise: 52, range: 2.0, arc: 90, lunge: 1.1, sfx: 'punchHeavy', chargeTime: 0.45 },
  dashPunch: { startup: 0.06, active: 0.08, recovery: 0.24, knock: 9.5, poise: 18, range: 1.9, arc: 90, lunge: 1.4, sfx: 'punchHeavy' },
  slam: { startup: 0.02, active: 0.14, recovery: 0.28, knock: 10, poise: 30, range: 3.0, arc: 180, aoe: true, sfx: 'slam' },
  grab: { startup: 0.10, active: 0.08, recovery: 0, range: 1.85, arc: 70, sfx: 'grab' },
  throw: { startup: 0.12, active: 0, recovery: 0.30, speed: 12.5, knock: 0.4, sfx: 'throw' },
  fish: { startup: 0.12, active: 0.08, recovery: 0.22, knock: 12, poise: 20, range: 1.9, arc: 120, lunge: 0.7, sfx: 'punchLight' },
  hammer: { startup: 0.28, active: 0.10, recovery: 0.38, knock: 26, poise: 45, range: 2.0, arc: 90, lunge: 0.5, sfx: 'punchHeavy', shake: 0.35 },
  bomb: { startup: 0, active: 0, recovery: 0, knock: 20, poise: 40, range: 3.0, arc: 360, aoe: true, sfx: 'explosion' },
};
