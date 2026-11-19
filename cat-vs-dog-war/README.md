# CAT VS DOG WAR

> 猫狗大战 — 5 洞草坪打地鼠。点掉钻出来的猫狗刷分，躲开石头、续上连击、别放跑动物。

## 运行

```bash
cd cat-vs-dog-war
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建、零依赖、零外链：`index.html` + ES Module，全部美术程序化 canvas / DOM，音频纯 WebAudio。

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 点动物 | 鼠标 / 触屏点击洞口 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 60 秒 = 3 波 × 20 秒，每波结束需达到累计分门槛（400 / 1200 / 2200），不达标判负。
- 4 种动物：猫咪(+100)、小狗(+200)、猎犬(4 击 +400)、金毛(2 击 +500)。
- 连击：2.5s 内连续击杀叠 ×2~×5 倍率。
- 石头：点了扣 1 心 + 扣分 + 断连击；动物逃脱也扣 1 心；3 心归零判负。
- 结算按分数给 1/2/3 星，最高分存档。

## 语言

- 默认英文，右上角下拉可切中文；`?lang=zh` 可覆盖，选择写入 localStorage。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```
