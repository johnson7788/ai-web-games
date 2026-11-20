# CONSTELLATION LINE · 星座连线

> 天文台描星：从起点星出发，每条线只画一次，把散星一笔连成星座。

## 运行

```bash
cd constellation-line
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（唯一例外站点 SDK `pipysdk`，加载失败自动降级）。

## 玩法

- 拖动 / 点按相邻的星连线；每条线段只能走一次（欧拉路径）。
- 走错会重置当前段并计一次失误；限时完成，超时失败。
- 高关有流星干扰（某段被遮 2s）、双星图（两个子图切笔）、必经北极星节点。
- 24 关、12 星座（5→18 颗星）、4 种边型、3 个场景包（春夜/夏银河/极光冬）。

## 语言

默认英文；右上角下拉可切中文；`?lang=zh` 可临时覆盖，选择持久化。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
index.html / styles.css   入口与样式
config/                   数值 / 关卡（levels.js 24 关）/ 文案 / design.json / SDK 配置
src/game/                 纯逻辑（euler.js 欧拉求解 / sim.js 模拟核心）
src/render/               程序化星空渲染（3 场景包）
src/ui/                   标题/HUD/结算/设置/首次引导
src/core/                 i18n / sdk 出口 / 程序化音频
tests/                    单测（70 条）
tools/                    selfplay / audio-check / verify.plan / record-gif / record-poster
```

## 调试契约

`window.__ll`：`state.phase` / `lang` / `setLang` / `run` / `start` / `pause` / `resume` / `restart`(回标题) / `retry` / `next` / `jump(levelIndex)` / `save` / `ui` / `debug.layout()` / `tutorial`。
