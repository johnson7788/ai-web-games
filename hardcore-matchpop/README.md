# HARDCORE MATCHPOP

> 硬核消消乐 — 霓虹街机的 10×10 同色连块消除

## 运行

```bash
cd hardcore-matchpop
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 点爆同色连块 | 点 / 触摸棋盘 |
| 炸弹（3×3 范围消除） | HUD `✸` 或 `B` |
| 洗牌（重排晶石） | HUD `⇄` 或 `S` |
| 暂停 / 继续 | `Esc` / `P` |
| 重开本关 | `R` |
| 静音 | `M` |

## 玩法

- 10×10 棋盘、5 色霓虹晶石；点一块晶石，与其 4 方向相连的同色晶石**整块爆掉**。
- 得分 = 组块数 × 10 − 5（单块 5 分、双块 15 分、三块 25 分……）。
- **连击**：3 秒内再次消除连击 +1，连击给分数加成。
- **岩石**：第 2 关起出现不可消除的岩块，阻挡晶石下落与整列左移。
- **道具**：每关 1 枚炸弹（3×3）＋ 1 次洗牌。
- 闯关：60s 内清空整盘并达到目标分（500 + 关卡 × 100）→ 过关，按剩余时间与超分给 1–3 星。
- 冲刺：30s 内与每妙涨分的对手竞速，分高者胜。

## 语言

- 默认 **英文**；标题右上角下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`hardcore-matchpop-lang`），刷新后保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；**en 与 zh 完整**。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html           入口
styles.css           样式（霓虹街机）
config/              配置与文案（design.json = 机器可读设计源）
src/core/            i18n / SDK / 音频
src/game/sim.js      纯逻辑（可测）
src/render/          程序化 canvas 渲染
src/ui/              UI
src/vendor/          pipysdk（本地 vendored）
tests/               测试
tools/               自对弈 / 验收计划 / 音频复验
```

## 调试契约

`window.__ll` 暴露标准调试接口：
- `state.phase`: title / playing / paused / result
- `start(i)` / `startRush()` / `pause()` / `resume()` / `restart()` / `home()`
- `run` / `sim` / `tutorial` / `startTutorial()` / `debug.*`
