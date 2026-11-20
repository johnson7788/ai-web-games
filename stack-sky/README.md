# STACK SKY · 云端叠塔

> Tap to drop floating islands, align them into a tower that climbs through dawn clouds, storm layers, and a starry palace sky.

改造自「叠叠乐」：经典 Stack 塔式玩法（顶块左右往复、点击截停、裁边变窄、完美连击回宽、高度即分数、镜头上移），原创「云端浮空岛」主题 + **风切**（每 10 层横风吹偏）+ **神龛层**（每 15 层对齐恢复宽度）+ **perfect×3 彩云缠绕**签名。三场景包：晨曦云海 / 雷雨层 / 星夜天宫。

## 运行

```bash
cd games/stack-sky
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建、零运行期依赖；断网可玩（唯一例外站点 SDK，加载失败自动降级）。

## 操作

| 动作 | 键 / 触摸 |
| --- | --- |
| 截停浮空岛 | 点击 / 空格 / 触摸 |
| 暂停 | Esc / P |
| 失败后重开 | R |
| 标题屏开始 | Enter |

## 门禁

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

全部 ≥WARN；详见 `docs/report.md`。

## 目录

```
config/    数值与文案（design.json = 机器可读设计源）
src/core/  i18n / 存档 / 音频 / SDK 唯一出口
src/game/  纯逻辑模拟（可 node 直测）
src/render/ Canvas 程序化渲染（三场景包 + 特效）
src/ui/    标题/HUD/暂停/结算/首次引导
src/main.js 装配 + window.__ll 调试契约
tests/     纯逻辑测试 + final 视觉证据
tools/     自玩/音频校验/验收计划/最终截图
docs/      源码分析 + 交付报告 + SEO
```
