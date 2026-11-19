# LIANKAN TILE LINK

> 霓虹连连看 · Neon memory match

零构建、零依赖、零外链的纯静态记忆翻牌游戏。玩法骨架 1:1 还原参考源码（记忆阶段 → 翻牌配对 → 计时判负 → bonus 秒数 → 连对胜出 → 解锁下一关），主题换皮为霓虹街机，并新增 **连击 Combo / 星级 Star / 道具 Peek** 三个机制。

## 运行

```bash
cd games/liankan-tile-link
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触控 |
| --- | --- |
| 翻牌配对 | 点击 / 点按卡牌 |
| 窥视 Peek | 点 HUD「PEEK」按钮 |
| 暂停 / 继续 | Esc 或 P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；`?lang=zh` 可临时覆盖；标题右上角下拉可切 **中文 / English**，写入 localStorage 后保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；**en 与 zh 完整**。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`

## 测试 / 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          霓虹街机样式
config/             配置与文案（design.json / levels.js / locales.js / sdk.config.js）
src/core/           i18n、sdk、audio（纯 WebAudio）
src/game/sim.js     纯逻辑（可测）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/main.js         主入口 + window.__ll 调试契约
tools/              自对弈 / 验收计划 / 音频校验 / 海报
```

## 调试契约

`window.__ll` 暴露：`state.{phase,lang}`、`start/pause/resume/restart/home`、`tutorial.{active,step,steps}`、`startTutorial`、`debug.{state,enterPlaying,solve,loadLevel,play,fail,layout}`。
