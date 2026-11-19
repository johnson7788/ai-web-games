# BUNNY GOLD DIGGER

> 兔子黄金矿工 · 霓虹街机黄金矿工

零依赖、零外链、纯静态：`index.html` + ES Module，`python3 -m http.server` 可跑；美术全程序化 canvas，音频纯 WebAudio。

## 运行

```bash
cd games/bunny-gold-digger
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 下放抓钩 | 点击 / 空格 / Enter |
| 触发黄金狂热 | F 或点 🔥（能量满时） |
| 提前结算 | N / 点 Bank（达标后） |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 玩法

摆角度下抓，抓金子/钻石得分；抓石头扣分并断连击；连续抓金攒连击；抓胡萝卜充满能量后触发「黄金狂热」4 秒金价翻倍。60 秒内达到目标分过关（提前结算保过关，或继续冲三星）。

## 语言

默认英文；标题右上角 / 暂停屏可切中文；`?lang=zh` 可覆盖。

## 测试 / 门禁

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
