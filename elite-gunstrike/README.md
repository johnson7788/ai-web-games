# ELITE GUNSTRIKE · 精英枪袭

霓虹街机弹射炮塔射击：拖拽甩出能量弹，靠重力下坠 + 撞墙反弹 + 能量核心链爆，在熔毁倒计时内击倒所有敌机，并保护带护盾的俘虏。

## 玩法

- **拖拽瞄准 / 松手发射**：从炮塔向外拖出方向，松手射出霓虹能量弹（带重力弧线 + 撞墙/掩体反弹）。
- **三种敌机**：侦察机（1 血）、炮塔机（2 血，会还击）、重装机甲（3 血）。
- **能量核心链爆**：击中核心会范围爆炸并连锁引爆相邻核心。
- **俘虏保护**：误中带护盾的平民机立即失败。
- **失败条件**：弹尽且敌机仍在 / 熔毁倒计时归零 / 炮塔被击毁 / 误中俘虏。
- **星级评级**：按用弹数评 1–3 星，驱动重玩。

## 运行

```bash
python3 -m http.server 8124   # 然后打开 http://127.0.0.1:8124
```

零依赖、零外链、零构建：`index.html` + ES Module，美术全程序化 Canvas，音频全 WebAudio。

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
