# MONSTER MELTER · 怪兽熔炉

> 霓虹果冻粉碎机 — 拖放发光宝石，填满一线熔化怪兽。

## 运行

```bash
cd games/monster-melter
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 拖放宝石到棋盘 | 拖动 / 触屏拖动 |
| 使用炸弹 | 点炸弹按钮，再点棋盘 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 玩法

六边形棋盘上，把托盘里的发光宝石拖到空位。任意方向（横 / 60° / 120°）填满一整条线，该线宝石就会化作光束攻击怪兽，把它的 HP 打到 0 即过关。

- **连击**：连续成线会叠加伤害与分数。
- **星级**：按步数结算 1–3 星。
- **岩石**：第 3 关起出现，挡线挡放置，用炸弹清除。
- **炸弹**：清除所在格及其两圈邻居（宝石 + 岩石）。

## 语言

- 默认英文；标题右上角可切中文。
- `?lang=zh` 可临时覆盖；选择写入 localStorage。

## 测试 / 验收

```bash
cd games/monster-melter
/opt/homebrew/bin/node --test                                  # ≥10 断言
/opt/homebrew/bin/node tools/selfplay.mjs                       # greedy/random/noinput → tools/fun/autoplay.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/tutorial
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式（霓虹街机）
config/             配置与文案（game.config / locales / sdk.config / design.json）
src/core/           i18n / sdk / audio（程序化 WebAudio）
src/game/           sim（纯逻辑）/ ai（贪心 bot）
src/render/         canvas 渲染
src/vendor/         pipysdk（vendored）
src/main.js         主入口 + 调试契约 window.__ll
assets/             空（美术全程序化）
tests/              测试
tools/              selfplay / audio-check / verify.plan / poster-shot
```
