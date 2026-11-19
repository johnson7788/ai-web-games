# SPOT THE ODD（霓虹找异类）

> 霓虹街机「找同类 + 找异类」单机小游戏：任务条给类别与数量，在 5×5 杂货堆里点选同类，找出闪烁伪装的 ODD 异类赚时间，和霓虹机器人竞速 5 回合拿三星。

## 运行

```bash
cd spot-the-odd
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建零依赖，`index.html` + ES Module 直接跑。

## 操作

| 动作 | 方式 |
| --- | --- |
| 点选物品 | 鼠标 / 触屏点击网格 |
| 提示 | HUD `Hint` 按钮（每局 3 次） |
| 暂停 | Esc / 暂停屏 |
| 重开 | R / 结算 Retry |
| 静音 | M / HUD 喇叭按钮 |

## 语言

- 默认 **英文**；标题右上角下拉可切 **中文**。
- `?lang=zh` / `?lang=en` 可临时覆盖；选择写入 localStorage（`spot-the-odd-lang`）。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 门禁自检

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
index.html          入口
styles.css          样式
config/             配置与文案（design.json / game.config.js / locales.js / sdk.config.js）
src/core/           i18n、SDK 出口、程序化音频
src/game/sim.js     纯逻辑（可测）
src/render/         canvas 渲染（霓虹网格）
src/ui/             DOM UI
src/main.js         主入口（60Hz 装配）
src/vendor/         pipysdk（本地降级版）
tests/              测试
tools/              自对弈 / 验收计划 / 音频 / poster
```

## 调试契约

`window.__ll` 暴露：`state.{phase,lang}` / `start` / `pause` / `resume` / `restart` / `run` / `tutorial.{active,step,steps,current,skip}` / `startTutorial` / `debug.solve`。
