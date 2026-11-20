# BRICK BLITZ · 窑火打砖

> 一款发生在陶窑里的街机打砖块游戏：滑动挡板，反弹烧红的陶珠，砸穿釉砖阵，触发「窑火全开」。

## 运行

```bash
cd games/brick-blitz
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态，无运行期依赖（唯一例外：站点 pipysdk，且能降级）。

## 操作

| 动作 | 键 / 触控 |
| --- | --- |
| 移动挡板 | 鼠标 / 触屏跟随；← → 或 A / D |
| 发射陶珠 | 点击任意处 / 空格 |
| 暂停 / 继续 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 门禁

```bash
node --test                                                        # 纯逻辑测试
node tools/selfplay.mjs                                            # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html / styles.css      入口与样式
config/                      design.json / game.config / levels / locales / sdk.config
src/core/                    i18n / sdk / audio / save
src/game/sim.js              纯逻辑（挡板/陶珠/釉砖/道具/胜负）
src/render/index.js          三窑场景程序化渲染
src/ui/ui.js                 屏幕显隐 + 语言切换
src/main.js                  装配 / 固定步长 / 流程状态机 / __ll 调试契约
src/vendor/pipysdk.js        站点 SDK（vendored）
tests/                       纯逻辑测试
tools/                       selfplay / verify.plan / audio-check / record-gif / make-poster
```

## 调试契约

`window.__ll`：`state.phase` / `start` / `pause` / `resume` / `restart` / `debug.state()` / `debug.loadLevel(i)` / `debug.startSeeded(i,seed)` / `debug.autoPlaceSolution()` / `debug.fastForward()`。
