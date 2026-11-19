# MERGE BASKETBALL

霓虹街机风的合成篮球（Suika/合成大西瓜式）网页游戏。纯静态、零依赖、零素材：Canvas 程序化渲染 + WebAudio 程序化音频。

## 玩法

- 左右瞄准，松开手指落下篮球；两个相同数字的球碰撞合成翻倍。
- 合到 **1024** 即「合成大篮球」，可继续追更大。
- 原创机制：**连击加分**、**岩石球**（不可合成）、**自动落球倒计时**（4s）、**三星评级**。
- 球顶越过顶部红线并停留判负。

## 运行

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 门禁

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

（`node` 在本机可能被 nvm-lazy 别名打断，用 `/opt/homebrew/bin/node` 直连即可。）
