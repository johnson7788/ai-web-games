# STAR BURST POP

> 星爆消消 · neon arcade。点击相连的同色星团引爆得分，用岩石碎裂与连击冲击三星。

## 运行

```bash
cd star-burst-pop
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖、零构建、零外链：`index.html` + ES Module + 程序化 canvas/WebAudio，`package.json` 为 `{"type":"module"}`。

## 玩法

- 10×10 棋盘，5 色星体 + 灰色岩石。
- **点选**：点任意星星选中它所在的同色连通团（≥2 才可选，预览得分）。
- **引爆**：再点一次该团，得分 `n²×5`，星星下落、整列左靠。
- **岩石**：不可直接消除；引爆其相邻星团会将其碎裂（+50）。
- **连击**：4 秒内连续引爆进入 combo，每级 +5。
- **评级**：每关死局结算按得分/目标评 1–3 星；3 关战役通关后看总星数（/9）。

## 操作

| 动作 | 键 |
| --- | --- |
| 点选 / 引爆 | 鼠标 / 触摸 |
| 暂停 | Esc |
| 重开 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` / `?lang=en` 可临时覆盖；选择写入 localStorage，刷新保留。
- 所有文案走 `config/locales.js` 的 `t()`；en 与 zh 完整（`i18n-check` 硬校验）。

## 测试 / 门禁

```bash
node --test                                              # 纯逻辑 ≥10 断言
node tools/selfplay.mjs                                  # 三策略 → tools/fun/autoplay.json
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
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n / 存档 / SDK / 程序化音频
src/game/sim.js     纯逻辑（可测）
src/render/         canvas 程序化渲染
src/ui/             DOM UI
src/main.js         装配 + 60Hz 固定步长
assets/             （无素材文件，全部程序化）
tests/              测试
tools/              自对弈 / 音频验收 / 验收计划
```

## 调试契约

`window.__ll` 暴露标准接口：`{ state:{phase,lang}, start, pause, resume, restart, retry, run, tutorial, startTutorial }`。
教程 DOM 带 `data-tutorial` / `data-tutorial-skip` 标记；竖屏提示 `#rotate-screen[data-rotate]` + `#btn-rotate-skip`。
