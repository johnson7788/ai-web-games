// 升级（补一笔）—— 一律用 mods 描述，sim 里只做通用叠加，不写特判分支。
// 可用的 mods 键：
//   fireRateMul / dmgMul / kickMul / bulletSpeedMul / spreadMul
//   maxInkAdd / inkRegenMul / inkPerKillAdd / inkPickupMul / magnetAdd
//   pelletsAdd / pierceAdd / splashAdd / magAdd / reloadMul
//   dashChargesAdd / dashCostMul / meleeDmgMul / meleeRangeAdd
//   lowInkDmgMul(墨<30% 时) / comboInkMul / reviveAdd / hurtInvulnAdd
// flags: 'airRecoil'（空中开火不受重力） / 'reflectKill'（笔锋反弹的子弹击杀回墨翻倍）
export const UPGRADES = [
  { id: 'quickdraw', nameKey: 'up.quickdraw.name', descKey: 'up.quickdraw.desc', icon: 'speed', mods: { fireRateMul: 1.14 } },
  { id: 'heavyink', nameKey: 'up.heavyink.name', descKey: 'up.heavyink.desc', icon: 'drop', mods: { maxInkAdd: 25, refill: 1 } },
  { id: 'scavenger', nameKey: 'up.scavenger.name', descKey: 'up.scavenger.desc', icon: 'magnet', mods: { inkPerKillAdd: 6 } },
  { id: 'recoilmaster', nameKey: 'up.recoilmaster.name', descKey: 'up.recoilmaster.desc', icon: 'recoil', mods: { kickMul: 1.35 }, flags: ['airRecoil'] },
  { id: 'twin', nameKey: 'up.twin.name', descKey: 'up.twin.desc', icon: 'split', mods: { pelletsAdd: 1, spreadMul: 1.15 } },
  { id: 'pierce', nameKey: 'up.pierce.name', descKey: 'up.pierce.desc', icon: 'arrow', mods: { pierceAdd: 1 } },
  { id: 'splash', nameKey: 'up.splash.name', descKey: 'up.splash.desc', icon: 'splash', mods: { splashAdd: 34 } },
  { id: 'dashcharge', nameKey: 'up.dashcharge.name', descKey: 'up.dashcharge.desc', icon: 'wind', mods: { dashChargesAdd: 1 } },
  { id: 'silentstep', nameKey: 'up.silentstep.name', descKey: 'up.silentstep.desc', icon: 'feather', mods: { dashCostMul: 0.5 } },
  { id: 'brushwork', nameKey: 'up.brushwork.name', descKey: 'up.brushwork.desc', icon: 'brush', mods: { meleeDmgMul: 1.6, meleeRangeAdd: 16 } },
  { id: 'magnet', nameKey: 'up.magnet.name', descKey: 'up.magnet.desc', icon: 'magnet', mods: { magnetAdd: 90, inkPickupMul: 1.2 } },
  { id: 'laststroke', nameKey: 'up.laststroke.name', descKey: 'up.laststroke.desc', icon: 'heart', mods: { lowInkDmgMul: 1.4 }, flags: ['lowInk'] },
  { id: 'comboink', nameKey: 'up.comboink.name', descKey: 'up.comboink.desc', icon: 'combo', mods: { comboInkMul: 1.5 } },
  { id: 'regen', nameKey: 'up.regen.name', descKey: 'up.regen.desc', icon: 'regen', mods: { inkRegenMul: 1.8 } },
  { id: 'thickline', nameKey: 'up.thickline.name', descKey: 'up.thickline.desc', icon: 'line', mods: { dmgMul: 1.2, bulletSpeedMul: 0.92 } },
  { id: 'finalcut', nameKey: 'up.finalcut.name', descKey: 'up.finalcut.desc', icon: 'shield', mods: { reviveAdd: 1 } },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export default UPGRADES;
