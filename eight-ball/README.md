# EIGHT BALL CLUB

> 八球俱乐部 —— 单人 8 球，对局一名 AI。零构建、零依赖、纯 Canvas。

## 运行

```bash
cd games/eight-ball
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out /tmp/shot.png   # 自带临时静态服务
# 或直接用任意静态服务器打开 index.html；ES Module 需要 http://，不能 file://
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 瞄准 + 出杆 | 在白球附近按下，向后拖到想要的力度，松手出杆 | 同左 |
| 预览准线 | 鼠标悬停即可（不按下） | 按下拖动时显示 |
| 自由球摆位 | 犯规后拖动白球到合法点松开 | 同左 |
| 暂停 | `Esc` / `P`，或右上角按钮 | 右上角按钮 |
| 重开 | 右上角 ↺ | 右上角 ↺ |
| 音效开关 | 右上角 ♪（静音写入存档） | 同左 |

拖拽距离映射力度 0…1，方向为拖拽的反方向；力度条实时显示。标题屏可选 AI 难度（业余 / 俱乐部 / 职业，默认俱乐部），选择写入存档。

## 玩法要点

- 开球必须碰到球堆；开球不进袋则换边。
- 开球后第一颗合法入袋定花色（1–7 实心 / 9–15 条纹），按先进顺序分配。
- 先碰对方球或空杆＝犯规，对手获得自由球；白球洗袋同样犯规。
- 清完本组 7 颗才能打 8 号；提前进 8 号判负，打 8 号同时洗袋也判负。
- 连续三次犯规不判负（简化规则）。
- AI 枚举「目标球 × 6 袋」的 ghost ball 线路，取成功率最高的一条并按难度加误差；无线路时打安全球（轻碰最近合法球），不会卡死。

## 语言

- 只有 **en（默认）/ zh** 两套完整文案，`CONFIG.languages = ['en','zh']`，`rtlLangs` 保持空数组。
- 标题右上角 / 暂停屏 / HUD 的下拉可切换；`?lang=zh` 可临时覆盖；选择写入 localStorage。
- 所有可见文案走 `config/locales.js` 的 `t()`，代码里没有中文字面量。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`

## 测试

```bash
node --test        # 22 个纯逻辑用例：物理、规则、AI、表现层事件、配置与存档默认值
```

## 验收

```bash
node --test
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/mobile.png --w 844 --h 390 --mobile
```

`desktop.png` / `mobile.png` 需要拍到台面、球号、准线和双方分组，因此在上述命令后加
`--wait 1600 --eval "(()=>{window.__ll.start();window.__ll.debug.setGroups('solid','stripe');return true;})()"`
直接进局取图；不带 `--eval` 的裸命令停在标题屏，同样 0 console error / 0 失败请求。

## 目录

```
index.html          入口（1280×720 letterbox 容器）
styles.css          HUD、覆盖层、--k 尺寸补偿
config/             game.config.js 数值与文案键、locales.js en/zh、sdk.config.js（Lead 维护）
src/core/           i18n / save / sdk 封装（Lead 维护，只调用不改）
src/game/           rng · physics · geometry · balls · match · ai · sim（纯逻辑，不碰 DOM/Date/random）
src/render/         Canvas 渲染（台面预渲染、球体贴图缓存、落袋动画、准线）
src/ui/             HUD 与覆盖层 DOM、程序化 WebAudio
src/main.js         固定步长循环、指针输入、SDK 接线、__ll 调试契约
tests/              sim.test.mjs 与 tests/final 验收产物
tools/verify.plan.json  浏览器验收计划（en/zh + 玩法断言）
```

无位图素材：台面、球、号码贴、音效全部程序化生成。

## 调试契约

`window.__ll`：

- `state`：`{ phase, lang }`，`phase ∈ title / playing / paused / over`（win 归一到 over）
- `start()` / `pause()` / `resume()` / `restart()`（回标题屏）
- `sim` / `match` / `ui` / `save(key, value)`
- `debug.shoot(角度, 力度)`、`debug.rivalShoot(角度, 力度)`、`debug.aiShoot()`
- `debug.setBalls([{id,x,y}])`、`debug.setGroups(you, rival)`、`debug.state()`
  → `{ phase, turn, groups, remaining, result, reason, foul, ballInHand, isBreak, shots }`
