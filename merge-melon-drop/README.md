# MERGE MELON DROP · 霓虹合成西瓜

> Suika 式落球合成：把同阶霓虹水果落在一起 → 合成下一阶，直到星爆瓜（NOVA）。霓虹街机风格，纯程序化 Canvas + WebAudio，零素材零外链。

## 运行

```bash
cd merge-melon-drop
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 左右瞄准 | A/D 或 ←/→；或拖拽指针 |
| 落球 | 空格 / ↓ / Enter；或松手 |
| 暂停 / 继续 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法（P0 1:1 原味 + 3 个新机制）

- **同阶合成**：两个同阶水果相碰 → 合成下一阶，得分 +阶数。合成两个 9 阶 → 星爆瓜（NOVA，+50 奖励）。
- **岩石**（新）：每 8 次落球出现一个不可合成的岩石，堵住空间；≥2 阶水果砸落可压碎（+5 分）。
- **连击**（新）：1.5s 内连续合成 → COMBO ×N，额外加分。
- **星级结算**（新）：按最高阶与分数给 1–3 星，结算屏展示。
- **判负**：任意水果顶端越过红色警示线并停留 3s → 游戏结束。

## 语言

- 默认**英文**；标题/暂停屏下拉可切**中文**；`?lang=zh` 临时覆盖，选择持久化（`merge-melon-drop-lang`）。
- 所有可见文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 测试与验收

```bash
node --test                                                    # 纯逻辑测试（19 条断言）
node tools/selfplay.mjs                                        # greedy/random/noinput 三策略遥测
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node tools/poster.mjs                                          # 生成 poster.jpg
```

## 目录

```
config/         数值 / 文案 / 设计源（design.json）/ SDK 配置
src/game/       纯逻辑模拟（sim，可测、seed 可复现）
src/render/     Canvas 2D 渲染（霓虹水果 / 岩石 / 粒子 / 落点预览）
src/ui/         UI 屏幕 / HUD / 多语言
src/core/       i18n / audio / sdk（存档埋点统一出口）
src/vendor/     vendored pipysdk.js（source:local，验收用）
tools/          自对弈 / 封面 / 音频验收 / verify plan
tests/final/    验收截图与报告
```

## 调试契约

`window.__ll` 暴露：`state:{phase,lang}` / `start` / `pause` / `resume` / `restart` / `run` / `tutorial:{active,step,steps}` / `startTutorial`，以及 `debug.*`（`dropAt` / `loadBoard` / `seedRun` / `gameOver` 等）供验收脚本使用。
