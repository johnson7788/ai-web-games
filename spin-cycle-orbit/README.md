# SPIN CYCLE ORBIT

> 旋转轨道 · 霓虹街机轨道弹跳

## 运行

```bash
cd games/spin-cycle-orbit
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 切换节点（命中窗口内） | 点击画布 / 空格 / 回车 |
| 重开本局 | R（或结算/暂停的 Retry） |
| 暂停 / 恢复 | Esc / P |
| 静音 | M |

## 玩法

两颗光球由一根光臂相连：一颗是锚点，另一颗绕它旋转。点击时旋转球若正好落在「下一个」能量节点的白色命中窗口内，就跳到下一节点继续前进；点早或点晚都会断环判负。

- **连击**：连续快速跳跃累积连击倍率（最高 ×8），超过 2.5s 或撞上岩核清零。
- **节点类型**：普通能量球 +1×连击；**金核** +3；**岩核** 清零连击。
- **狂热**：每 8 次捕获触发 4s 加速；等级随捕获数上升，角速度越来越快。

## 语言

- 默认 **英文**，右上角下拉可切 **中文**；`?lang=zh` 可覆盖。
- 全部可见文案走 `config/locales.js` 的 `t()`。

## 测试与验收

```bash
node --test                                    # 纯逻辑单测（15 条）
node tools/selfplay.mjs                        # greedy/random/noinput → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

截图物料：`node tools/make-final.mjs`（生成 `tests/final/*.png` 与根目录 `poster.jpg`）。

## 目录

```
index.html          入口
styles.css          样式（霓虹街机 / 教程卡固定底部居中 / 竖屏提示）
config/             配置与文案（design.json / game.config.js / locales.js / sdk.config.js）
src/core/           i18n、存档、音频（纯 WebAudio）、SDK
src/game/sim.js     纯逻辑（可 Node 无头测）
src/render/         Canvas 2D 程序化渲染
src/ui/             UI
src/main.js         主入口 + window.__ll 调试契约
src/vendor/         pipysdk（本地 vendored，零外链）
tests/              单测 + final/ 截图 + artifacts/
tools/              自对弈 / 音频验收 / 截图生成 / verify.plan.json
```

## 调试契约

`window.__ll`：`{ state:{phase,lang}, start, pause, resume, restart, run, tutorial:{active,step,steps}, startTutorial, endTutorial, debug:{startSeeded, forceCapture, gameOver, step} }`。
