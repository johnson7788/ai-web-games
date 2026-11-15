# PIXEL MINE 3D（方块矿工）

> 第一人称体素挖矿：越深越值钱，修矿道买升级。

## 运行

```bash
cd pixel-mine-3d
python3 -m http.server 8124   # 或任意静态服务器
# 打开 http://127.0.0.1:8124/
```

零构建纯静态（index.html + ES Module），零运行期外链（唯一例外 pipysdk，失败自动降级可玩）。

## G0 · 八问

1. **一句话**：第一人称视角挖方块——越深矿越值钱，背包装满就回地面卖矿、买升级，最后挖穿基岩进宝藏房。
2. **参考**：Minecraft（挖矿/背包）、SteamWorld Dig（越深越值钱 + 升级循环）、voxelcraft（体素思路）。只借鉴品类。
3. **差异化**：① 48×64×48 有限世界 + 确定性矿脉，一局一世界；② 卖矿/升级/梯子/体力/岩浆构成一条紧凑经济循环；③ 挖穿基岩进一次性宝藏房作为终局目标。
4. **操作**：桌面 WASD 移动 + 鼠标视角 + 左键长按挖 + 右键放梯 + Tab 升级 + E 背包 + R 回营地；触屏左摇杆移动 + 右滑视角 + 挖/放梯/跳/营地按钮。
5. **一局**：单局 3–6 分钟（到宝藏房或主动收工）；失败 = 体力耗尽/岩浆强制回营地（掉一半未卖矿）；爽点在第 20–40 秒卖出第一笔矿、第 3 分钟挖穿岩层见金脉。
6. **成长**：局内成长 = 镐速/背包/体力/头灯 + 5 个规则升级（矿脉感知/双倍掉落/自动冶炼/背包整理/岩浆免疫）；跨局成长 = 最深纪录 + 总资产存档。
7. **结局**：通关（挖到宝藏）看「宝藏到手！」结算；收工看「收工！」结算；重开回标题一键再来。
8. **乐趣**：主乐趣 = 好奇（越深有什么？），副乐趣 = 掌控（升级后挖得更快更省）。第 3 分钟还想继续 = 差一点就能挖到下一层矿、差一点就够钱买升级；第一个有代价的决定在第 10 秒（浅层煤稳赚 vs 直奔深层）。

- **乐趣假设**：深层高价值矿 + 升级正反馈会让玩家愿意为「再来一趟」回来；用 greedy/random/noinput bot 遥测 + fun-report 验证（首胜 ≤60s、事件密度、推进率）。
- **签名记忆点**：挖穿最后一层岩石，整条发光金矿脉在眼前展开。
- **反范围**：不做联机、不做合成表、不做怪物战斗、不做无限世界、不做剧情。
- **美术来源**：程序化占位渲染（体素 + 发光矿脉 + 头灯），AI 素材（天空/贴图/海报）预留槽位后续替换。

## 操作

| 动作 | 键（触屏） |
| --- | --- |
| 移动 / 视角 | WASD / 鼠标（左摇杆 / 右滑） |
| 挖方块（长按） | 鼠标左键（MINE 按钮） |
| 放梯子 | 鼠标右键（LADDER） |
| 跳 | Space（JUMP） |
| 升级站 | Tab 或 E（BAG） |
| 回营地 | R（CAMP） |
| 暂停 | Esc |

## 数据契约

- **世界/坐标**：48×64×48 体素，块 `(x, by, z)`，`by=0` 是地表，向下越深；世界空间 y = `-(by+0.5)`（上正下负）。地表平面 y=0，玩家 feet 在 y=0。出生点块中心 `(24.5, 0, 24.5)`。
- **实体**：玩家 `{x,y,z,vx,vy,vz,yaw,pitch,onGround,stamina,hp}`（AABB 0.6×1.8，eye +1.62）。
- **方块类型**：`T = {AIR,DIRT,STONE,COAL,IRON,GOLD,DIAMOND,BEDROCK,LAVA,LADDER,TREASURE}`；每类 `{value 卖价, hardness 挖掘秒, color, emissive, glow}`。
- **事件**（sim 推 → main 分发 → render/audio/ui 消费）：`mine_start / crack / block_break / ore_collect / sell / upgrade / climb / ladder_place / stamina_low / forced_return / return / lava_hit / inventory_full / goal_complete / depth_record / gold_vein / treasure_found / win / session_end`。事件形如 `{type, t, ...payload}`。
- **模块 API**：`createSim({seed,bestDepth})` / `updateSim(run, input)` / `getHud(run)` / `drainEvents(run)` / `buyUpgrade(run,id)` / `recallToCamp(run,voluntary)` / `finish(run)`。渲染 `createRenderer(canvas).render(run)`，UI `ui.showTitle/showGame/showPause/showResults/updateHUD/popup`，音频 `audio.event(name)`。
- **输入契约**：`{yaw, pitch, f, s, jump, mine, place, target?}`；jump/place 为单帧边沿（main 层做边沿检测），target 仅 bot 使用。
- **状态机**：`title → playing → paused → playing`，`playing → results → title`；`run.phase`：`playing | finished`（宝藏=win，收工=cashout）。
- **调试口**：`window.__ll`（`state.phase / run / hud / start / pause / resume / restart / tutorial.skip / finish / recall / setInput`）+ `window.G`（Game/UI/Render/Audio/Save）。

## 测试 / 验收

```bash
/opt/homebrew/bin/node --test                              # 纯逻辑 23 条
/opt/homebrew/bin/node tools/selfplay.mjs                  # greedy/random/noinput bot
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/desktop.png
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/final/mobile.png --w 844 --h 390 --mobile
```

## 已知 TODO（诚实清单）

- 发光矿脉用 `MeshBasicMaterial`（无光照常亮）近似自发光，未接真实 emissive/点光随矿脉走。
- 梯子攀爬是「贴到梯子格即上/下」，无精细吸附动画。
- 回营地（R/按钮）是传送便捷操作，未强制手动爬梯（爬梯仍可用）。
- 体素碰撞为分轴 AABB，无斜面滑动/边缘站立优化。
- 关卡「层」为深度分层（土/石/煤/铁/金/钻/基岩），非独立关卡场景。
- AI 素材（天空/贴图/海报）仅预留加载槽位，当前程序化占位；未跑 vision-review（§5 未列，需视觉模型 key）。
