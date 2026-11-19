# PENGUIN PAL · 企鹅伙伴

> 养一只北极小企鹅：喂食、洗澡、陪玩、学习、打工，跟着心愿气泡累积照顾连击，把它养到 3 级。

## 运行

```bash
cd penguin-pal
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖、零构建、纯静态（`index.html` + ES Module）。

## 玩法

| 动作 | 效果 |
| --- | --- |
| 🍗 喂食 | 降低饥饿 |
| 🛁 洗澡 | 提升清洁 |
| 💤 休息 | 恢复体力 |
| ⚽ 玩耍 | 提升心情 |
| 📖 学习 | 赚经验（主要升级手段） |
| 💼 打工 | 赚金币 |
| 🛒 商店 | 买 🐟/🍦/🧸 道具 |

- 企鹅头顶的**心愿气泡**告诉你要做什么；照做累积 **照顾连击**（+经验 +金币），做错清零。
- 升到 **3 级** 触发结算，按健康度给 **1~3 星**。
- `Esc` 暂停；移动端竖屏会自动提示旋转，可一键跳过。

## 语言

默认英文；右上角下拉可切中文。`?lang=zh` 可临时覆盖。

## 测试与验收

```bash
node --test                                    # 单测
node tools/selfplay.mjs                        # 三策略自对弈
node tools/audio-check.mjs                     # 音频离屏复验
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/artifacts
```

## 目录

```
index.html         入口
styles.css         样式（HUD/动作条/教程卡/竖屏提示）
config/            game.config.js / sdk.config.js / design.json / locales.js
src/core/          i18n / sdk / save / audio（程序化 WebAudio）
src/game/sim.js    纯逻辑（可单测、可无头自对弈）
src/render/        canvas 程序化绘制（房间 + 企鹅 + 心愿气泡 + 粒子）
src/ui/            DOM UI
src/main.js        60Hz 装配 + window.__ll 调试契约
src/vendor/        vendored pipysdk（已清空外部 fetch 地址）
tools/             自对弈 / 音频验收 / 验收计划
```

## 调试契约

`window.__ll`：`state.phase`、`start/pause/resume/restart`、`run`、`tutorial{active,step,steps,skip}`、`startTutorial`、`debug{act,buy,setStat,grantXp,win,state,hud}`。
