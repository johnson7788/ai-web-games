# GARDEN BLOOM TYCOON

> 花园绽放大亨 —— 播种、收获、进化，绽放你的花田帝国

闲置经营（tycoon）网页游戏：程序化 canvas 手绘卡通花园，零素材零外链零构建，纯静态 ES Module。

## 运行

```bash
cd garden-bloom-tycoon
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 收获 / 升级 / 进化 / 解锁 | 点对应花田（单点智能动作） |
| 破岩 | 点底部岩石 |
| 暂停 / 继续 | Esc / P |
| 重开花园 | R |
| 静音 | M |

## 玩法

- 六阶原创花种（向阳芽→月华苞→星露花→余烬花→霜瓣→梦蔷薇），随时间产金币。
- 收获金币 → 升级（每轮更多金币）→ 满级进化（新品种 + 鲜花）。
- 鲜花数量解锁九块花田；底部岩石击碎换金币与水滴，周期性重生。
- 三新机制：**岩石**（额外金币来源）、**连击**（2.5 秒内连续收获 ×2/×3）、**水滴道具**（立即结算一轮生长）。

## 语言

- 默认 **英文**；`?lang=zh` 可覆盖；选择写入 localStorage，刷新保留。
- 所有可见文案走 `config/locales.js`；en 与 zh 完整。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/tutorial
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll`：`state{phase,lang}` / `start` / `pause` / `resume` / `restart` / `home` / `run` / `tutorial{active,step,steps,current,skip}` / `startTutorial` / `debug.*`。
