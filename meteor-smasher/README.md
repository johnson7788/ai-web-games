# METEOR SMASHER

> 陨石破坏王 · 霓虹街机风的「弹跳 + 点击砸击」街机游戏。驾驶发光飞行器，在陨石带里砸碎陨石、连击冲分，避开尖刺、用修复台控制热度。

## 运行

```bash
cd meteor-smasher
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 砸击 | 点击画布 / 空格 Space |
| 暂停 / 继续 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法（1:1 复刻《陨石破坏王》P0）

- 飞行器自动弹跳；每撞一次地板，**热度 +5**，满 35 坠毁。
- **点击向下砸击**：砸中陨石击杀并连击 +1（连击乘分）；砸中能量核心 +15、推进器弹高 +8、修复台把热度压回 8。
- **避开尖刺陨石**：砸中它热度 +10 且连击清零。
- 距离驱动等级提升：等级越高实体越快、刷怪越密。

## 语言

- 默认英文；标题右上角 / 暂停屏下拉可切中文。`?lang=zh` 可覆盖。
- 全部可见文案走 `config/locales.js` 的 `t()`；en/zh 完整。

## 门禁自检

```bash
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
```

## 目录

```
index.html / styles.css      入口 + 霓虹街机 UI
config/                      数值 / 设计源 / 文案 / SDK 配置
src/game/sim.js              纯逻辑（Node 可测）
src/render/index.js          Canvas 程序化渲染
src/ui/ui.js                 DOM 多语言与屏幕显隐
src/core/audio.js            WebAudio 程序化 BGM/SFX
src/core/sdk.js              SDK 唯一出口（降级）
src/vendor/pipysdk.js        本地 vendored SDK
tests/                       纯逻辑测试
tools/                       selfplay / verify.plan / audio-check
```

## 调试契约

`window.__ll` 暴露 `state.phase` / `start` / `pause` / `resume` / `restart` / `run` / `tutorial` / `startTutorial` / `debug`。
