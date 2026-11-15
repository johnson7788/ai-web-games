# SANDBOX ISLE（沙盒小岛）

> 品类：模拟经营 · 平台：浏览器（桌面 + 移动）· 语言：默认英文，中文必做（ja/ko/ar/ru 未做，已整块不暴露）

## 0. G0 八问

1. **一句话**：在一座 32×24×32 的有限体素小岛上，玩家挖方块、建方块、养鸡羊孔雀、完成每日目标，最后集齐 7 色方块建成彩虹桥。
2. **参考**：Minecraft / 星露谷（只借鉴品类：体素挖建 + 农场喂养，不抄素材）。
3. **差异化**：① 3 分钟=1 天的紧凑昼夜节奏，喂饱动物次晨自动产蛋卖金币；② 每日目标给稀有彩虹方块，把「自由建造」和「目标推进」绑成一条线；③ 孔雀开屏瞬间彩羽粒子 + 金蛋掉落（签名记忆点）。
4. **操作**：桌面 WASD 移动 + 鼠标视角 + 左键挖 + 右键放 + 1–6 选方块 + V 切视角 + E 互动；触屏摇杆移动 + 拖拽视角 + 挖/放按钮 + 底部方块栏。
5. **一局**：单局无强制失败；3 分钟一天，完成 3 个每日目标约 2 分钟见首胜；彩虹桥建成即结算（约 7–8 个目标）。
6. **成长**：局内：方块库存、金币、体力、每日目标；跨局：无（纯单局沙盒，存档仅语言/静音/引导完成）。
7. **结局**：建成彩虹桥 → 全屏彩羽庆祝 + 结算卡（金币/已完成目标/天数）→ 重开或回标题。
8. **乐趣**：主乐趣 = 表达（造景），副乐趣 = 好奇（探索岛与动物）。第 3 分钟玩家还想继续，因为「再喂一天动物、再集一色方块」的短循环奖励在滚动。第一个有代价的决定在第 10 秒：先挖石头还是先砍木头。

**签名记忆点**：孔雀开屏，彩羽粒子炸开，金蛋叮当落地。

**反范围（不做）**：联机、战斗、超过 32×24×32、复杂合成、剧情。

**美术来源**：程序化体素渲染 + AI 天空贴图（assets/sky.jpg）与 AI BGM（assets/audio/bgm.mp3）；缺失自动回退程序化，不白屏不报错。

## 1. 核心循环

- 秒级：移动 → 对准方块 → 挖（得方块）→ 放（幽灵预览）。
- 局级：挖/建攒库存 → 收萝卜 → 喂动物 → 次晨产蛋卖金币 → 完成每日目标得稀有方块。
- 长线：3 个每日目标/天 → 集 7 色方块各 20 → 建彩虹桥 → 结算。

## 2. 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 移动 | WASD | 左摇杆 |
| 视角 | 鼠标（点击锁定指针） | 拖拽 |
| 挖 | 左键 | ⛏ 按钮 |
| 放 | 右键 | ＋ 按钮 |
| 选方块 | 1–6 / 滚轮 | 底部方块栏 |
| 视角切换 | V | ⇅ 按钮 |
| 互动（喂/收） | E | （摇杆靠近后自动 E） |
| 暂停 | Esc | — |

## 3. 数据契约（src/game/sim.js 为唯一几何真相）

- **世界**：`Uint8Array(32×24×32)`，索引 `idx=(y*D+z)*W+x`；`getBlock/setBlock` 唯一读写口；id 0 空气，1–6 草/木/石/沙/水/花（可放置），7–13 彩虹 7 色（不可放置，桥材料）。
- **玩家**：`{ x, z, y(脚底), yaw, pitch, stamina, gold, slot, inventory{}, rainbow{}, carrots }`；`y` 每帧由地形地面快照计算。
- **动物**：`{ id, type, x, z, y, yaw, state(wander|eat|flee), fedToday, fan, ... }`。
- **事件**：`start/dig/place/feed/harvest/produce/goal_complete/day/peacock_fan/gold_egg/collapse/win`（sim 发，render/audio/ui 各自消费）。
- **API**：`createSim({seed})` / `updateSim(sim, input, dt)` / `drainEvents(sim)` / `getHud(sim)` / `raycast(sim, ox,oy,oz,dx,dy,dz)` / `buildBridge(sim)` / `forceWin(sim)`。
- **输入**：`{ move:{x,z}, yaw, pitch, slot, action:{kind:'dig'|'place'|'interact', x,y,z,block?}, interact }`。
- **状态机**：`title → playing ⇄ paused → results → title`；`sim.phase: playing|won`。
- **调试口** `window.__ll`：`state.phase` / `run` / `hud` / `start/pause/resume/restart/startAct` / `tutorial{active,step,steps,current,skip}` / `demo.win()` / `setSlot` / `setLang`。

## 4. 测试与验收

```bash
/opt/homebrew/bin/node --test
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node tools/selfplay.mjs
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/mobile.png --w 844 --h 390 --mobile
```

## 5. 已知 TODO / 未做项

- 动物 flee 状态用 `Math.random()`（表现层随机），不影响判定与 seed 回归（判定/经济均 seed 化）。
- 彩虹方块只作为桥材料计数，不进入可放置热键栏（设计「7 色方块」只用于终局建造）。
- 触屏互动（喂/收）未做独立 E 按钮，靠摇杆靠近后自动触发 `interact`（桌面 E 已完整）。
- 无跨局成长/排行榜（反范围：单局沙盒）；存档仅语言/静音/引导完成。

## 6. 运行

```bash
cd sandbox-isle
python3 -m http.server 8124   # 仅本地调试；验收脚本自带服务
```
