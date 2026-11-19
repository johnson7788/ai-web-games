# VIRUS BUSTER CELLS

> 细胞病毒歼灭战 · 霓虹街机射击（零构建纯静态，零外链零素材文件）

## 运行

```bash
cd virus-buster-Cells
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触控 |
| --- | --- |
| 移动飞船 | A / D / ← / → 或 拖拽 |
| 开火 | 按住 / 空格（1.5s 无输入自动开火） |
| 清屏炸弹 | B（需持有炸弹） |
| 暂停 | Esc |
| 重开 | R |

## 玩法

底部霓虹飞船，击落上方降落的带血量病毒细胞；击杀掉金币，血条清零过关。
第 2 关起出现打不碎的晶体碎片（撞上掉命）；连击提升掉金倍率；击杀概率掉落道具球
（加速 / 散射 / 护盾 / 回血 / 清屏）。金币用于升级火力 / 射速 / 金币价值 / 护盾。

## 语言

- 默认 **英文**，标题 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。
- 所有文案走 `config/locales.js` 的 `t()`，en 与 zh 完整。

## 测试 / 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式（霓虹街机）
config/             配置/关卡/文案/设计源/SDK
src/core/           i18n / 存档 / SDK / 音频
src/game/sim.js     纯逻辑（可 node --test / selfplay）
src/render/         Canvas 2D 程序化渲染
src/ui/             DOM UI
src/main.js         主入口
tests/              测试与最终截图
tools/              自对弈 / 验收计划 / 音频验收 / 海报
```

## 调试契约

`window.__ll`：`state.phase` / `start` / `pause` / `resume` / `restart` / `run` /
`tutorial`（active/step/steps/current/skip）/ `startTutorial` / `debug`（state/winLevel/loadLevel/setTutorialDone）。
