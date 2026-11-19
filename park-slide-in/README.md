# PARK SLIDE IN

> 霓虹停车 · 滑行入位（Neon parking arcade）

霓虹街机风停车解谜：转动前轮、给油滑行，把发光小车无碰撞地停进发光车位，按时间与零碰撞拿 1–3 星。3 关，含倒车入库、能量球连击、护盾道具与移动巡逻无人机。

## 运行

```bash
cd games/park-slide-in
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 前进 | W / ↑ / 方向盘 ▲ |
| 倒车 | S / ↓ / 方向盘 ▼ |
| 左转 | A / ← / 方向盘 ◀ |
| 右转 | D / → / 方向盘 ▶ |
| 松开油门 = 滑行 | 松键 / 松手 |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 玩法

- 把车**完全停进**发光虚线车位并**停稳**（速度足够低）即入位成功。
- 能量球：路上收集，连击叠加；护盾：可抵挡一次碰撞。
- 星级：基础 1 星 · 零碰撞 +1 · 限时内 +1。
- 第 3 关的巡逻无人机守护护盾——绕开它，或看准时机。

## 语言

- 默认 **英文**，右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 `localStorage`（`park-slide-in-lang`）。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`

## 测试 / 验收

```bash
node --test                                            # 单测
node tools/selfplay.mjs                                # greedy/random/noinput → tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll` 暴露：`state{phase,lang}`、`start/pause/resume/restart/home`、`run`、`tutorial{active,step,steps}`、`startTutorial`、`debug.loadLevel/solve/state`、`save/ui/fps`。

## 目录

```
config/   数值 / 关卡 / 文案 / 设计源 / SDK 配置
src/game/sim.js        纯逻辑仿真（自行车模型 + SAT 碰撞 + 事件）
src/game/autopilot.js  自动泊车控制器（selfplay greedy 用）
src/render/index.js    程序化霓虹 canvas 渲染
src/ui/ui.js           屏幕显隐 + 语言
src/core/audio.js      纯 WebAudio 程序化 BGM/SFX
src/core/sdk.js        SDK 唯一出口（存档走 Sdk.save/load）
src/vendor/pipysdk.js  本地 vendored SDK（关闭运行时热更新/服务端校验）
tools/                 自对弈 / 验收计划 / 音频验收 / 海报
tests/                 单测 + 门禁截图产物
```
