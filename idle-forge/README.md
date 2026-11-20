# IDLE FORGE · 铁匠挂机铺

> 挂机铁匠铺：锤子自动锻造装备产金币，四线升级（锤力/锤速/火温/学徒），12 关攒出「大师之作」，离线也有收益。

## 运行

```bash
cd idle-forge
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态 + 零运行期依赖（唯一例外站点 SDK）。

## 操作

| 动作 | 键/触屏 |
| --- | --- |
| 敲击铁砧（手动补锤） | 点击铁砧 / `Space` |
| 升级四线 | 点底部卡片 / `1` `2` `3` `4` |
| 加温（炉候窗口） | 点 🔥 / `F` |
| 安抚学徒（罢工） | 点 ✋ / `A` |
| 暂停 | `Esc` / `P` |
| 重开本关 | `R` |
| 静音 | `M` |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。只暴露 en/zh（未翻完的语言整块不暴露）。
- `?lang=zh` 可临时覆盖；选择写入 `idle-forge-lang`，刷新保留。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`。

## 门禁（全自动，全绿才算完成）

```bash
node --test                                                        # 纯逻辑 ≥15 条
node tools/selfplay.mjs                                            # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root . # ≥WARN
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .  # ≥WARN
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 调试契约

`window.__ll`：
- `state.phase`：title / playing / paused / result
- `start(i)` / `pause()` / `resume()` / `restart()` / `home()`
- `debug.state()` / `debug.layout()` / `debug.loadLevel(i)` / `debug.startSeeded(i,seed)`
- `debug.autoForge(n)`：greedy 自动玩到第 n 关；`debug.fastForward()`：快进到终章结算

## 目录

```
config/      配置与文案（design.json = 机器可读设计源）
src/core/    i18n / sdk / audio
src/game/    sim（纯逻辑）/ level
src/render/  三场景 Canvas 渲染
src/ui/      UI 薄适配
src/main.js  主入口 + __ll 契约
tests/       测试；tests/final/ 验收截图
tools/       自对弈 / 验收计划 / 音频 / 录 gif / 海报
```
