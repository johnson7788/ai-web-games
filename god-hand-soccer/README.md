# GOD HAND SOCCER

> 神手足球 · 双神手各控一名前锋的霓虹街机躲避跑

## 运行

```bash
cd games/god-hand-soccer
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖零构建：`index.html` + ES Module，纯 canvas/SVG/DOM 程序化美术，纯 WebAudio 音频。

## 玩法

- 两名前锋自动向上狂奔，球场分 4 车道（左半 2 条 / 右半 2 条）。
- **点球场左半边**：左手前锋在左半两条车道间切换；**点右半边**：右手前锋在右半两条车道间切换。
- 每半场每条障碍只挡一条车道，把前锋移到空车道躲开防守屏障；滚动岩石会在两车道间漂移，要持续预判。
- 接住能量晶片叠**连击**换分；吃**护盾/减速/磁吸**道具；关卡到终点按晶片数结算 **1–3 星**。
- 无尽模式冲距离榜；关卡模式逐关解锁新元素。

## 操作

| 动作 | 键 / 触控 |
| --- | --- |
| 左手前锋切道 | 点左半场 / `A` `←` |
| 右手前锋切道 | 点右半场 / `D` `→` |
| 暂停 / 继续 | `Esc` / `P` |
| 重开本局 | `R` |
| 静音 | `M` |

## 语言

- 默认**英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可覆盖；选择写入 localStorage（`god-hand-soccer-lang`）。
- 文案全部走 `config/locales.js` 的 `t()`，en/zh 双完整。

## 测试 / 验收

```bash
cd games/god-hand-soccer
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node tools/shots.mjs   # 生成 tests/final/*.png 与 poster.jpg
```

## 目录

```
index.html          入口
styles.css          样式
config/             数值/关卡/文案/SDK/设计源
src/core/           i18n / 存档 / SDK / 音频
src/game/sim.js     纯逻辑模拟（可无头测试）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/main.js         60Hz 装配 + 调试契约
tests/              测试
tools/              自对弈 / 音频验收 / 截图 / verify 计划
```

## 调试契约

`window.__ll` 暴露：`state.{phase,lang,dir}`、`start(i)` / `pause()` / `resume()` / `restart()` / `home()`、`run`、`tutorial.{active,step,steps,current}`、`startTutorial()`、`debug.{state,seedScene,seedRock,setDistance,win,lose}`。
