# SLICE LAB · 切片实验室

> 霓虹激光实验室：划一条直线，把随机水晶切成等大的两半。

## 运行

```bash
cd games/slice-lab
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建、零依赖、零外链；`index.html` + ES Module 即可跑。

## 操作

| 动作 | 方式 |
| --- | --- |
| 划刀切割 | 鼠标/手指在水晶上拖一条直线 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |
| 菜单 | HUD 右上 ⌂ |

## 玩法

1. 每关一个随机凸多边形水晶。
2. 拖一条直线切开；均分度 = `min(A,B) / ((A+B)/2) × 100`，**≥95 过关**，越高星级越高（95/98/100 → 1/2/3 星）。
3. 避开红色岩核，切到岩核这一刀作废；连续过关叠连击；后期水晶会旋转、倒计时收紧。

## 语言

- 默认 **英文**；标题右上角可切 **中文**；`?lang=zh` 可覆盖并写入 localStorage。

## 门禁

```bash
node --test
node tools/selfplay.mjs
node tools/shots.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll`：`state.phase/lang`、`start/pause/resume/restart/retry/home`、`tutorial`、`debug.startSeeded/autoSlice/fastForward`。
