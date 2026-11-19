# SNOWMAN FACTORY

> 雪人工厂 — 看准时机把冰激凌球丢进传送带上经过的蛋筒。

## 运行

```bash
cd snowman-factory
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触点 |
| --- | --- |
| 丢冰激凌球 | Space / 点击画面 / 点右下「DROP」 |
| 暂停 / 继续 | Esc / P |
| 重开（本局） | R |
| 静音 | M |

## 玩法

- 蛋筒从左上管道落下，滑到传送带向右移动。
- 看准时机丢球，让冰激凌球落进发光接住区里经过的蛋筒。
- 连击接住叠到 **×5**；落空或砸中岩石会清空连击并掉一条命。
- 金色蛋筒 **+5 分 & +1 命**；5 命耗尽工厂停工。
- 每关接满 6 个升关，传送带越来越快；「疯狂」模式另有 130s 倒计时。

## 语言

- 默认英文；标题 / 暂停屏下拉可切中文。
- `?lang=zh` 可覆盖；选择写入 localStorage，刷新保留。

## 测试与门禁

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
index.html / styles.css    入口与样式
config/                    game.config / locales / design.json / sdk.config
src/core/                  i18n / audio / sdk
src/game/sim.js            纯逻辑模拟（可 node --test / selfplay）
src/render/index.js        canvas 程序化渲染（手绘卡通）
src/ui/ui.js               DOM 显隐与语言
src/vendor/pipysdk.js      本地 SDK（runtimeConfigUrl/appConfigUrl 已清空）
src/main.js                主入口与调试契约
tests/                     单元测试
tools/                     selfplay / audio-check / verify.plan / shots
```
