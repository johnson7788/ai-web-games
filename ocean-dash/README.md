# OCEAN DASH

> 带领洄游鱼群的侧视竞速：自动前进，上下躲避，散聚取舍，借洋流成箭形光带冲向终点。

## 运行

```bash
cd games/ocean-dash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 |
| --- | --- |
| 上 / 下 | ↑ / W / ↓ / S（或指针拖动） |
| 收拢鱼群（窄缝可过但慢） | 按住 Space |
| 跃出水面 / 滑翔 | J（或点击；空中按住 = 滑翔） |
| 暂停 | Esc / P |
| 重跑 | R |

触屏：拖动转向，`≋` 收拢、`↟` 跃起。

## 玩法

- 自动前进，与 3 条 AI 竞速；名次 ≤2 晋级下一赛段。
- 吃气泡回鱼 + 加速；洋流带让鱼群列成箭形光带（signature）。
- 散开 = 快但易撞，收拢 = 窄缝可过但慢。
- 12 赛段 / 3 场景包（珊瑚浅滩 · 深沟 · 红树林）。

## 测试与门禁

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

## 目录

```
index.html / styles.css      入口与样式
config/                      数值、关卡、文案、设计源、SDK 配置
src/game/                    纯逻辑 sim + 地图生成
src/render/                  三场景包程序化渲染
src/ui/                      屏幕 / HUD / 首次引导
src/core/                    i18n / SDK 出口 / 程序化音频
src/main.js                  装配 / 固定步长 / 状态机 / __ll 调试契约
tools/                       自玩 / 验收 / 录屏 / 海报
docs/                        源码分析 / SEO / 交付报告
```

## 调试契约

`window.__ll`：`state.phase` / `lang` / `setLang` / `run` / `start` / `pause` / `resume` / `restart` / `tutorial` / `save` / `ui` / `debug.layout()`。
