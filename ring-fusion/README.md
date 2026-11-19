# RING FUSION

> 环环相扣 · 三环同色，霓虹融合

一款零依赖、零外链的霓虹街机「环环相扣」消除益智游戏。在 3×3 星环盘上拖拽同心环到空位，横、竖、斜线凑齐 3 个同色环即融合消除；连续消环叠加连击倍率，攒满能量触发「爆发」一键清点。原创机制：岩石槽位（随消行震碎）、连击充能爆发、星级评级。

## 运行

```bash
cd ring-fusion
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 方式 |
| --- | --- |
| 拖拽手牌到环点 | 鼠标 / 触摸拖拽 |
| 爆发清点 | 点击「爆发」后点任意环点 |
| 暂停 / 重开 / 静音 / 说明 | 顶部 HUD 按钮 |
| 语言 | 标题右上角下拉（en / 中文），或 `?lang=zh` |

## 语言

- 默认 **英文**；可切 **中文**。`?lang=zh` / `?lang=en` 可临时覆盖；选择写入 localStorage，刷新保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`。

## 测试与门禁

```bash
node --test                                        # 单元测试（15 条）
node tools/selfplay.mjs                            # greedy/random/noinput → tools/fun/autoplay.json
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
index.html            入口
styles.css            样式（霓虹街机）
config/               配置 / 文案 / 设计源 / SDK 配置
src/core/             i18n、存档、SDK、音频
src/game/sim.js       纯逻辑（可测）
src/render/           Canvas 2D 渲染（程序化）
src/ui/               DOM UI
src/main.js           主入口（60Hz 固定步长 + 调试契约）
tests/                单元测试
tools/                自对弈 / 验收计划 / 音频验收 / 海报
```

## 调试契约

`window.__ll` 暴露：`state.phase`（title/playing/paused/result）、`start/startTime/pause/resume/restart`、`run`、`tutorial`（active/step/steps/current/skip）、`startTutorial`、`debug`（startLevel/place/burstAt/seedBoard/autoWin）。
