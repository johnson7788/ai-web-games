# UNBLOCK CARS · 霓虹挪车

Rush-Hour 滑动拼图（6×6 车库）：拖动霓虹车流，把发光的青色主车送到右侧 EXIT。
纯静态、零依赖、零外链；美术全 Canvas 程序化，音频全 WebAudio 程序化。

## 运行

```bash
cd unblock-cars
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 玩法

- **拖动**车辆沿车道前后滑动；车辆不能穿车、不能穿岩石。
- 把**主车**（青色、带 ▲）滑到右侧绿色出口即通关。
- 步数 ≤ 标准步 +3 → 3 星；≤ 标准步 +10 → 2 星；否则 1 星。
- 步数达到上限 → 判负（堵死）；`R` 一键重开。
- **提示**（每局 3 次）与**撤回**；连续滑动触发**连击计分**。
- 第 3 关起出现**岩石障碍**（不可移动）。

## 语言

默认英文；标题右上角 / 暂停屏下拉可切中文。`?lang=zh` 可覆盖，写入 localStorage。

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

## 目录

```
index.html          入口
styles.css          样式
config/             配置/文案/设计源/关卡（levels 由 src/game/levels.js 生成）
src/core/           sdk / i18n / audio
src/game/           levels（生成+求解）/ sim
src/render/         Canvas 霓虹渲染
src/ui/             UI 薄层
src/main.js         主入口（60Hz 装配 + __ll 契约）
tests/              node --test
tools/              selfplay / audio-check / verify.plan.json
```

## 调试契约

`window.__ll`：`state{phase,lang}`、`start/pause/resume/restart/home/run/sim`、
`tutorial{active,step,steps,current}`、`startTutorial`、`debug{state,layout,loadLevel,solve,autoSolve,...}`。
