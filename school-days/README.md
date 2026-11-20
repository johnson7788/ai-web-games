# SCHOOL DAYS · 山间学堂

> 在山村经营一间小学堂，把小熊猫村童送上大考放榜。

## 运行

```bash
cd games/school-days
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态 + 零运行期依赖（唯一例外：站点 pipysdk，且断网可降级）。

## 玩法

- 12 周（12 关）日程制校园经营：每周 5 个课时，从「算学 / 习武 / 游学 / 休息」四门里分配。
- 资源：金币、体力；属性：成绩 / 体魄 / 心情 / 声望。
- 每周目标达标 +1 星，随机事件（疫病 / 庆典 / 暴雨…）逼你在金币与属性之间取舍。
- 第 12 周大考放榜：核心两门（成绩 + 体魄）达标即胜，四门全过 = 三星。

## 操作

| 动作 | 键 |
| --- | --- |
| 分配课程 | 点左侧科目卡 |
| 撤销课程 | 点已排的课时槽 |
| 结束本周 | 点左下角 End Week |
| 事件选择 | 点弹窗选项 |
| 暂停 | Esc / P |

## 调试契约

`window.__ll` 暴露 `state.phase / start / pause / resume / restart / home / sim / tutorial / debug.state / debug.loadLevel / debug.startSeeded / debug.fastForward`。

## 门禁

```bash
cd games/school-days
/opt/homebrew/bin/node --test
/opt/homebrew/bin/node tools/selfplay.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node tools/audio-check.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```
