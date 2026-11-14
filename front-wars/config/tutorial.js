// 首次进入的交互引导：每一步都要求真实操作，由 sim 的 tutorialStep 推进。
export const TUTORIAL_STEPS = [
  { id: 'move', titleKey: 'tutMoveTitle', textKey: 'tutMoveText' },
  { id: 'aim', titleKey: 'tutAimTitle', textKey: 'tutAimText' },
  { id: 'shoot', titleKey: 'tutShootTitle', textKey: 'tutShootText' },
  { id: 'dash', titleKey: 'tutDashTitle', textKey: 'tutDashText' },
];
