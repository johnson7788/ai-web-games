# RPS DUEL QI · 石拳气功对决

霓虹街机风格的猜拳对决。宗师每回合亮出一张手势，你要在倒计时内打出克制它的一招。

- 石拳克剪刀、剪刀克布掌、布掌克石拳（标准猜拳）
- 连胜攒「连击」；每 5 胜攒满一气，可「气功爆发」自动赢下一回合
- 怒气 1→5：选错或超时怒气 +1，连胜怒气 −1；怒气到 5 即破体出局
- 打满 30 回合 = 通关；按分数 / 连击 / 是否通关给出 1–3 星

## 运行

```bash
python3 -m http.server 8124   # 或任意静态服务器
# 打开 http://localhost:8124/
```

零依赖零构建：`index.html` + ES Module，纯 canvas/SVG/DOM + 程序化 WebAudio。

## 门禁

```bash
cd games/rps-duel-qi
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```
