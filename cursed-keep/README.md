# CURSED KEEP · 诅咒要塞

经典路径塔防（Tower Defense）。敌人沿蜿蜒路径进攻要塞，在发光塔位建塔拦截；击杀赚金币，升级/出售塔，撑过 10 波。三种塔：箭塔（快单体）/炮塔（溅射）/冰塔（减速）。三种敌人：步兵/疾行/重甲。

- 品类：策略 / 塔防
- 参考：Cursed Treasure 2 / Bloons TD（只借鉴品类，数值与代码全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 战场 + DOM 建造栏 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长战斗

## 运行

```bash
cd games/cursed-keep
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 选塔（点建造栏或按 `1/2/3`），点发光塔位建造。
- 点已建塔 → 升级 / 出售面板。
- `Space` 或「召唤下一波」按钮提前开波；`Esc`/`P` 暂停。

## 规则与计分

- 初始 120 金币 / 20 生命；击杀得金币，敌人抵达终点扣生命（重甲扣 3）。
- 塔属性随等级提升（伤害 ×1.5/级，射程 ×1.1/级，最高 3 级）；出售回收 70%。
- 10 波，血量倍率与敌人组合递增；生命归零失败，撑满 10 波胜利。最佳波次存档。

## 测试与验收

```bash
node --test                                                   # 11 条纯逻辑测试（建塔/战斗/波次/胜负）
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
```

## 目录

```
config/      game.config（塔/敌人/波次/规则）/ map（路径/塔位）/ locales / sdk.config
src/game/    sim.js（纯逻辑：路径行进/瞄准/弹道/波次，固定步长 tick）
src/render/  index.js（路径/塔/敌人血条/弹道/爆炸粒子）
src/ui/      ui.js（标题/暂停/胜负 + HUD + 建造栏 + 塔面板 + 多语言）
src/core/    i18n / save / sdk（SDK 唯一出口）
tests/       sim.test.mjs + final/（验收截图）
```

## 调试契约 `window.__ll`

`state.phase` ∈ title|playing|paused|won|lost；`start/pause/resume/restart`；
`debug.state()` / `debug.build(spot,type)` / `debug.upgrade(id)` / `debug.sendWave()` / `debug.addGold(n)` / `debug.step(sec)` / `debug.towers()`。

## 国际化

仅 `en`（默认）+ `zh`；塔名/敌人/界面双语。