# BUBBLE SHOOTER POP

> 霓虹泡泡射手 · Neon arcade bubble shooter

底部霓虹炮台会自动向上开火。左右滑动炮台，对准坠落的泡泡击破它们；躲开泡泡，接住道具，连击冲高分。放走 6 个泡泡即失败。

## 运行

```bash
cd games/bubble-shooter-pop
python3 -m http.server 8200
# 打开 http://127.0.0.1:8200/
```

零构建、零依赖、零外链。纯静态 `index.html` + ES Module。

## 操作

| 动作 | 键 / 触摸 |
| --- | --- |
| 左移 | A / ← / 拖动 |
| 右移 | D / → / 拖动 |
| 手动连发 | Space / 快速点按 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 泡泡类型

- **普通泡泡**：霓虹四色，1 点血。
- **岩石泡泡**（第 2 波起）：紫色盾牌泡泡，需多次命中。
- **黄金泡泡**（第 3 波起）：高分，击破后掉落道具。
- **炸弹泡泡**（第 4 波起）：击破后爆炸，连锁清除周围泡泡。

## 道具

- **⚡ 急速射击**：自动射击频率 ×3，持续 8s。
- **≋ 三连射**：一次三发扇形弹幕，持续 8s。

## 语言

默认英文，右上角可切中文；`?lang=zh` 可覆盖。

## 验收门禁

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
