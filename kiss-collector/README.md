# KISS COLLECTOR · 亲亲收集家

> 24 个甜甜整蛊谜题，集齐一罐亲亲。点、拖、长按、翻转，破解丘比特的甜蜜机关。

## 运行

```bash
cd kiss-collector
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 说明 |
| --- | --- |
| 点击 | 点选 / 连点 / 按顺序点 / 点影子 |
| 拖拽 | 把物体拖到目标 / 拖离遮挡物 / 拖旋转把手 |
| 长按 | 按住约 1.2 秒触发（神灯 / 戒指盒 / 蜡烛 / 新人） |
| 暂停 | Esc / P |

## 机制（相对同类型 baseline 新增）

- **长按 hold**：按住物体不松手触发。
- **顺序点 tapSeq**：按屏幕编号顺序点物体，点错顺序重置进度并计失误。
- **亲亲收集 + 连击**：每关按星级得亲亲；连续零失误通关累积连击，连击 ≥3 额外 +1 亲亲。

## 语言

- 默认 **英文**；`?lang=zh` 可覆盖；标题右上角下拉可切 **中文**。
- 所有文案在 `config/locales.js`（en/zh 完整，全平铺）。

## 测试 / 门禁

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
index.html / styles.css     入口 + 样式
config/                     配置、文案、24 关数据、design.json、sdk.config
src/core/                   i18n、sdk、程序化 audio
src/game/                   sim（纯逻辑谜题引擎）+ rng
src/render/                 4 场景包 + 丘比特 + 机关道具（程序化 Canvas）
src/ui/                     UI 装配 + 首次交互引导
src/main.js                 主入口（60Hz 固定步长装配）
tests/                      纯逻辑测试
tools/                      自玩 bot / 验收计划 / 截图 / 海报 / 音效校验
```
