# FLAME CRAFT

> 火焰工匠 · 霓虹街机「接燃料 · 锻造三层火焰」小游戏

## 运行

```bash
cd flame-craft
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左移 | A / ← |
| 右移 | D / → |
| 移动（移动端） | 按住并拖动 |
| 暂停 | Esc |

## 玩法

你是**烬灵**（发光余烬），在霓虹炉火里左右移动：

- **接燃料**：金色/蓝/橙「+」光球，填满能量条，把篝火锻造成 **焰心→内焰→外焰** 三层。
- **煤块**：深色多边形，+3 大额燃料，落得更快。
- **躲危险**：蓝色雨滴、灼热火星（红色十字、瞄准你当前位置），被击中扣 1 生命。
- **连击**：窗口内连续收集，得分倍率与燃料收益递增。
- 锻造满三层火焰 → 过关（+500 分、回 1 生命、难度递增）；生命归零 → 火苗熄灭。

## 语言

- 默认 **英文**；标题右上角 / 设置屏的下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。
- 全部可见文案走 `config/locales.js` 的 `t()`；en/zh 完整。

## 测试 / 验收

```bash
node --test                                                        # 单元测试
node tools/selfplay.mjs                                            # greedy/random/noinput 自玩 → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node tools/capture.mjs && node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html            入口
styles.css            样式
config/               design.json / game.config.js / locales.js / sdk.config.js
src/core/             i18n / save / sdk / audio（程序化 WebAudio）
src/game/             sim（纯逻辑）/ rng
src/render/           霓虹 Canvas 渲染
src/ui/               screens / hud / tutorial / index
src/main.js           装配 + window.__ll 调试契约
tests/                测试与验收截图
tools/                selfplay / verify.plan / capture / poster / audio-check
```

## 调试契约

`window.__ll` 暴露标准接口：`state.phase`（title/playing/paused/dead/win）、`start/pause/resume/restart/startTutorial`、`run`（sim 实例）、`tutorial`（active/step/steps/current/skip）、`debug.forceCraft`。
