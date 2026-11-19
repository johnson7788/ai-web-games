# STORM FIGHTER JET

> 风暴战机 · 霓虹街机风躲避射击

驾驶霓虹喷气战机穿梭风暴：躲避追踪导弹与岩石，连击金色能量核心，用蓝色护盾挡下致命一击，冲击最高分。

## 运行

```bash
cd storm-fighter-jet
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖零外链零构建：`index.html` + ES Module，程序化 canvas/SVG/DOM 美术 + 纯 WebAudio 音频。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 转向 | 拖动屏幕任意位置（浮动摇杆）/ 方向键 / WASD |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法规则（P0）

- 战机持续前飞，拖动摇杆改变航向；航向有转弯半径，指错方向就冲进弹幕。
- **追踪导弹**（3 型：慢/中/快）从 HUD 下方三边生成，持续锁定玩家；**直线导弹**沿对角线封锁路径（第 4 波起）；**岩石**漂移占道（第 3 波起）。
- **金币**（+10×连击倍率）成簇生成，连续拾取触发**连击倍率**（最高 ×5），被击中则连击归零。
- **护盾**道具可挡下一次撞击；护盾被消耗后短暂无敌。
- 每秒存活 +1 分；坠毁后按分数评 1–3 星，破纪录有「新纪录」提示。

## 语言

- 默认 **英文**；`?lang=zh` 可覆盖；标题屏 / 暂停屏下拉切换，选择写入 localStorage 保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 测试与门禁

```bash
node --test                       # ≥10 条断言
node tools/selfplay.mjs           # greedy/random/noinput → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

截图物料：`node tools/shots.mjs` 产出 `tests/final/*.png` + 根目录 `poster.jpg`（1280×720，战斗画面）。

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（game.config / levels / locales / sdk.config / design.json）
src/core/           i18n / sdk / audio
src/game/sim.js     纯逻辑（可 Node 无头测试）
src/render/         程序化 canvas 渲染（霓虹街机）
src/ui/             UI 薄适配
src/main.js         主入口（60Hz 固定步长装配）
src/vendor/         pipysdk.js（本地降级，runtimeConfigUrl 已置空）
tests/              单元测试 + 截图产物
tools/              selfplay / shots / audio-check / verify.plan.json
```

## 调试契约

`window.__ll`：`state{phase,lang}` / `start` / `pause` / `resume` / `restart` / `home` / `run` / `tutorial{active,step,steps,current,skip}` / `startTutorial` / `debug{state,die,setLevel,spawnRock,spawnCoins,startSeeded,fastForward}`。
