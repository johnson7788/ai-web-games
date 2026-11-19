# FRUIT FRENZY BLADE

> 水果狂刃 · 霓虹街机切水果

用指尖挥刀切开飞起的水果，避开炸弹与岩石，用连击触发暴走 ×2 冲高分。

## 运行

```bash
cd games/fruit-frenzy-blade
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零依赖零外链，纯静态（`index.html` + ES Module）。

## 操作

| 动作 | 方式 |
| --- | --- |
| 挥刀切水果 | 鼠标 / 手指在画面上滑动 |
| 暂停 / 继续 | Esc 或 HUD ⏸ |
| 快速重开 | R 或结算「再来一局」 |
| 静音 | HUD 🔊 / 🔇 |
| 语言 | 标题 / 暂停右上角下拉（en / zh，`?lang=` 可覆盖） |

## 玩法

- 切中水果得分；连续快切连击，连击数越高单刀分越高。
- 连击 ≥5 触发 **暴走 FRENZY ×2**（5s 内得分翻倍）。
- 千万别碰 **炸弹**（立即结束）；**岩石** 不扣命但断连（wave 2 起）。
- **金果** 高分（wave 3 起，第 8 个必出）；漏掉水果扣 1 命，3 命结束。
- 每 10 个水果推进一波，炸弹/岩石/金果概率随之上升。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node tools/poster-shot.mjs   # 生成 poster.jpg
```
