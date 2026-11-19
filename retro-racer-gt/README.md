# RETRO RACER GT

> 复古GT赛车 · 霓虹街机风 4 车道纵向赛车

## 运行

```bash
cd retro-racer-gt
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左变道 | ← / A / 点 ◀ / 点屏幕左 40% |
| 右变道 | → / D / 点 ▶ / 点屏幕右 40% |
| 氮气冲刺 | ↑ / W / Space / 点 ⚡ NITRO |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 4 车道纵向公路：中车道为**同向慢车**，边车道为**对向快车**。
- 车速自动加速到极速；**氮气**可短暂超速，并**对车流无敌**（撞开同向车）。
- **岩石**固定在路上，**氮气也救不了**，必须绕行。
- **能量星**加分并充氮气冷却；**连续超车**叠连击，分数按连击层数加成。
- 碰撞即结束；结算金币 = 分数/20 + 10，累计可用于解锁（本版为程序化霓虹车，未接商店 UI）。

## 语言

- 默认 **英文**；`?lang=zh` 可覆盖，标题右上角下拉可切 **中文**。
- 所有可见文案走 `config/locales.js` 的 `t()`。

## 门禁

```bash
cd retro-racer-gt
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
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
index.html          入口
styles.css          霓虹街机样式
config/             数值 / 文案 / SDK / 设计源（design.json）
src/game/sim.js     纯逻辑（Node 无头可测）
src/render/         Canvas 程序化渲染
src/core/           i18n / audio(WebAudio) / sdk / save
src/vendor/         vendored pipysdk（零外链）
src/main.js         60Hz 装配 + 调试契约 window.__ll
tests/              单元测试
tools/              selfplay / verify.plan / audio-check / scene-shots
```

## 调试契约

`window.__ll`：`state.phase` / `start` / `pause` / `resume` / `restart` / `home` /
`tutorial{active,step,steps,skip}` / `startTutorial` / `debug{state,seedRun,fastForward,crash,forceSpawn}`。
