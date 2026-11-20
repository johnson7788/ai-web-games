# TILE TRIAD · 药草集市

> 层叠三消：点发亮的顶牌，凑齐三张同款货品即消，别让收槽塞满。改造自「羊了个羊 cocos3.0」。

## 运行

```bash
cd tile-triad
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态，无运行期依赖（唯一例外：站点 SDK，本地 vendored 降级）。

## 操作

| 动作 | 输入 |
| --- | --- |
| 拾取顶牌入槽 | 点击 / 触屏点按 |
| 撤回 / 洗牌 | HUD 按钮 |
| 暂停 / 继续 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 玩法

- **层叠牌局**：每堆货品自底向上叠放，上层压住下层；被压住的牌变灰不可点。
- **拾取入槽**：点发亮的顶牌，移入底部收槽（7 格 → 6 格）。
- **三同消除**：槽内三张同款即消，陶罐碰撞出香料烟尘，掌柜小猫欢呼。
- **槽满判负**：收槽塞满却凑不出三张，本关失败。
- **道具**：撤回（回退最近一张）、洗牌（重排板上货品品类）。
- **三星**：通关 +1；无道具 +1；高效（限时关剩时 ≥25%，普通关收槽峰值 ≤ 容量-2）+1。

## 12 关三轴递进

槽位 7→6、层数 2→5、品类 6→12，叠加：压顶大层 → 分区双塔 → 假锁层 → 限时收摊 → 道具关 → 终局大阵。
三章换景：晨光集市（L1–4）→ 午后市集（L5–8）→ 灯会夜市（L9–12）。

## 可解性

`src/game/board.js` 用「逆向发牌」构造每关必然存在不依赖道具的解，`validateSolution()` 线性验证、`solveBoard()` 回溯 DFS 二次证明（单测覆盖 12 关）。

## 数据契约（摘要）

- 逻辑世界 1280×720，60Hz 固定步长（`STEP = 1/60`）。
- `createRun(levelIndex, opts)` → `run`，`run.state` 字段：`phase / stacks / slot / slotCap / totalTiles / cleared / moves / maxSlot / timeLimit / timeLeft / undoLeft / shuffleLeft / stars`。
- 事件：`pick / slotAdd / reveal / clear / catReact / nearFull / undo / shuffle / milestone / win / lose / countdownTick`。
- 纯逻辑层（`src/game/*`）零 DOM/window/localStorage/Date.now，随机用 seed 注入。

## 目录

```
index.html / styles.css    入口与样式
config/                    design.json（设计源）/ levels / locales / sdk.config / game.config
src/core/                  i18n / sdk / audio
src/game/                  sim / board（生成器+求解器）
src/render/                Canvas 2D 渲染（三场景 + 12 类货品 + 小猫）
src/ui/                    UI 薄层
src/vendor/                pipysdk.js（vendored 降级）
tests/                     node:test 纯逻辑
tools/                     selfplay / audio-check / verify.plan / record-gif / final-shots / poster / icon
```

## 调试契约（`window.__ll`）

- `state.phase`：title / playing / paused / result
- `start(i) / pause() / resume() / restart() / home()`
- `debug.state()` / `debug.layout()` / `debug.loadLevel(i)` / `debug.startSeeded(i,seed)` / `debug.autoPlaceSolution()` / `debug.fastForward()` / `debug.tapStack(sid)`
- `tutorial`：`{ active, step, steps, current }`；`startTutorial()`
- `save(k,v) / load(k,f) / ui() / fps()`

## 语言

默认英文；`?lang=` 可覆盖；下拉切中英，选择写入 localStorage 刷新保留。全部文案走 `config/locales.js`。
