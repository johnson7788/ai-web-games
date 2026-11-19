# MEOW MIAO · 喵了个喵

霓虹街机风的三消牌堆游戏（参考「喵了个喵」玩法规则，主题/美术/音乐全部程序化原创）。

## 运行

```bash
cd games/meow-miao
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 玩法

- 点一块**发光的可拿方块**（柱子顶端），它会被搬进下方 7 格等待架。
- 凑齐 **3 块同花色**（⭐ 万能牌可代替任意花色）即消除。
- 等待架超过 7 格或时间耗尽 → 失败；清空所有方块 → 胜利（剩余时间 + 连击决定 1–3 星）。
- 道具：↻ 洗牌（1 次/局）、⎌ 撤回（2 次/局）；岩石格是不可用的地形格，压缩棋盘、逼高牌堆。

## 门禁（自检全绿）

```bash
cd games/meow-miao
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
```

## 目录

```
index.html / styles.css    入口与样式
config/                    design.json / levels.js / locales.js / game.config.js / sdk.config.js
src/game/sim.js            纯逻辑（生成/匹配/道具/星级，可无头测试）
src/render/index.js        canvas 程序化渲染（预渲染贴图 + 粒子）
src/core/                  i18n / save / sdk / audio（WebAudio 程序化）
src/main.js                装配（60Hz 固定步长 + __ll 调试契约）
tools/                     selfplay / verify.plan / audio-check / poster
```

## 调试契约

`window.__ll`：`state{phase,lang}`、`start/pause/resume/restart/home`、`run`、`tutorial{active,step,steps,current}`、`startTutorial`、`debug{state,layout,loadLevel,startSeeded,solve,fastForward,giveUp,setTutorialDone}`。
