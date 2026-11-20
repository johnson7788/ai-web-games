# INK FINCH（墨雀）

> 一只墨色雀在水墨竹海里单键上扑穿缝，每次振翅溅出墨点，穿过竹节记一分朱砂红。
> 改造自 `local/src1/黑白像素鸟-cocos/`；玩法 1:1 还原，主题/场景/角色全原创。

## 运行

```bash
cd games/ink-finch
python3 -m http.server 8124
# http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 上扑 | 点击 / 空格 / ↑ / 触屏任意处 |
| 长按滑翔（气流关） | 按住不放 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 契约（数据/接口/状态机）

- **世界**：1280×720 逻辑世界；地面 `GROUND_Y=660`、天花板 `CEILING_Y=0`；60Hz 固定步长（`STEP=1/60`）。
- **实体**：`bird = { x, y, vy, vx, r }`（x 常驻 260，逆风关被风吹偏）；`gates[]`（竹节列）。
- **竹节**：`{ x, w, kind:'single'|'double', gapY/gapTop/gapBottom, scored, wheel? }`；双缝另有 `upperCenter/lowerCenter/nearCenter`。
- **事件**（sim → render/audio/ui）：`levelStart / flap / ink / gateApproach / gatePass / bonus / nearMiss / breeze / altitude / updraft / windGust / wheelSpin / win / death`。
- **API**：`createRun(levelIndex, {seed}) → { state, step(dt), flap(), setHold(b), drainEvents(), getHud() }`。
- **状态机**：main `phase` = `title / playing / paused / result`；run `state.phase` = `ready / playing / won / lost`。
- **调试口**：`window.__ll`（`state.phase / start / pause / resume / restart / debug.state() / debug.loadLevel(i) / debug.startSeeded(i,seed) / debug.autoPlay() / debug.fastForward()`）。
- **存档/埋点/广告**：只走 `src/core/sdk.js`（配置 `config/sdk.config.js`，appId `pipy-ink-finch`）。

## 目录

```
index.html / styles.css      入口与水墨 UI
config/                      game.config / design.json / levels / locales / sdk.config
src/core/                    i18n / save / sdk / audio（程序化五声 BGM + 10 SFX）
src/game/                    sim（纯逻辑）/ ai（bot 控制器）
src/render/                  Canvas 2D 水墨渲染（三场景包）
src/ui/                      屏幕显隐 + 语言
src/main.js                  装配 / 固定步长 / 教程 / 调试契约
tests/                       node:test 纯逻辑（30 条）
tools/                       selfplay / verify.plan / audio-check / record-gif / make-assets
```

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```
