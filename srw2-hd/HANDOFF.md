# SRW2 HD — 项目交接文档（Handoff）

> 面向接手的 AI / 开发者。读完这份就能继续改，不需要翻聊天记录。
> 最后更新：2026-11-09（v3.1：CHR 地形 + 80 台 HD 立绘 + 全量剧情 + 19 首 NSF BGM）

---

## 1. 这是什么

FC《第2次超级机器人大战》（1991，Winky Soft / Banpresto）的**网页高清重制**：
保留原版 26 话的关卡、地图、站位、增援与战斗规则，用现代网页技术重做界面与演出。

- **明确不是**：模拟器套壳（那是 `games/srw2-web` 的路线）。
- **当前阶段（v3.1）**：26 话可完整通关的战棋游戏。地形由 ROM CHR tile 精确还原；
  80 个机体 sprite key 全部 HD；28 章逐句中文剧情（战前播放、可跳过）；
  19 首 NSF 真实 BGM 按话轮换；界面中英双语；接入了公共 SDK。

原版 ROM（仅供本地素材提取，不入库）：
`/Users/admin/Documents/Game/fc第二次机器人大战/第二次机器人大战.nes`

---

## 2. 怎么跑

```bash
cd games/srw2-hd
python3 -m http.server 8125
# 打开 http://127.0.0.1:8125
```

零构建、零 npm 依赖、零 CDN。所有资源在本地，断网可玩。

**自动验收**（会自己起随机端口的静态服务器）：

```bash
python3 tests/sweep.py            # 83 项检查，退出码 0 = 全过
python3 tests/sweep.py --headed   # 看着浏览器跑
python3 tests/sweep.py --shots /tmp/shots
```

依赖：`python3 -m pip install playwright && python3 -m playwright install chromium`。

URL 参数：

| 参数 | 作用 |
| --- | --- |
| `?lang=zh` / `?lang=en` | 强制语言（默认跟随浏览器，可点 HUD 的「EN/中」切换并记忆） |
| `?maps=ai` | 使用 AI 重绘底图（观感更“HD”，但地形布局会漂移，仅供对比） |
| `?pixel=1` | 地图单位改用原版 16×16 CHR 图标（默认走 AI 立绘） |

---

## 3. 目录与职责

```
games/srw2-hd/
├─ index.html            页面骨架：HUD / canvas / 侧栏 / 对话框 / 结算 / cut-in / SDK
├─ styles.css            全部样式（深空面板、cut-in 动画、移动端）
├─ config/
│  ├─ data.js            规则常量：GRID / TERRAIN（含空陆海移动表）/ LEGEND / SPIRITS
│  ├─ units.js           ★ 85 台机体数据库（80 个 sprite key；名称/立绘/档位/武器/英文名）
│  ├─ scenarios.js       ★ 生成产物：26 话地形/站位/增援/NPC/胜负条件（勿手改）
│  ├─ locales.js         中英文案（UI + 日志模板）
│  └─ audio-tracks.js    26 话 × 4 类音轨表（3 条真实录音 + 按话 rate 微调）
├─ src/
│  ├─ main.js            ★ 装配：输入、动画、回合流转、相机、存档、音频、SDK
│  ├─ game/engine.js     ★ 纯逻辑：移动/攻击/反击/再攻击/精神/升级/回合/AI/胜负/存档
│  ├─ render/renderer.js 地图层（底图裁切 + 网格）、机体矢量绘制、特效、相机
│  ├─ ui/ui.js           侧栏、战况、对话打字机、结算、i18n 渲染
│  ├─ core/i18n.js       ?lang > localStorage > 浏览器；t() 与目标文案
│  ├─ core/audio.js      BGM 切换/淡入淡出/按话变速/cut-in 压低音量
│  ├─ core/sdk.js        公共 SDK 薄封装（缺失时全部 no-op）
│  └─ sdk/               gamesdk.js / sdk.config.js / sdk-styles.css（公共 SDK 拷贝）
├─ data/
│  ├─ gcgx.json          ★ GCGX 26 话攻略原始数据（坐标/等级/EXP/资金/增援/NPC/目标/攻略文）
│  └─ story.json         ★ 中文标题/摘要/战术简报 + 英文简报 + 目标翻译（人工整理）
├─ assets/
│  ├─ hd/maps/s01..s26.webp      官方地图 ×4 + 锐化（默认，布局正确）
│  ├─ hd/maps-ai/s01..s26.webp   AI 重绘版（?maps=ai）
│  ├─ hd/units/*.webp            80 个 sprite key 的 HD 立绘（7 张原有 + 73 张 AI）
│  ├─ hd/units-side/*.webp       80 张侧面战斗立绘（cut-in 用）
│  ├─ hd/fx/*.webp               beam / impact / explosion-1..3
│  ├─ hd/portrait-*.webp         乔 / 由美 / 大卫 立绘（备用）
│  ├─ hd/tiles/*.webp            9 张地形贴图（实验方案，当前未启用）
│  ├─ audio/                     标题/剧情/战场 3 条录音 + nsf/ 19 条 NSF 渲染
│  └─ extracted/                 官方地图原图（16px/格）、CHR 图集、截帧
├─ tools/                 数据管线与素材脚本（见第 9 节）
├─ tests/sweep.py         ★ 自动验收（56 项）
└─ README.md              开发日志（按时间记录）
```

**备份**：`games/.srw2-hd-backup`（更早的版本，已加入 .gitignore）。

---

## 4. 数据管线（改动前必读）

```
GCGX 攻略页 ──scrape_gcgx.py──► data/gcgx.json
                                      │
官方地图 PNG ──terrain.py──►  地形字符矩阵 + 内容框
                                      │
                    build_scenarios.py ─┴─► config/scenarios.js
                                      │
                            data/story.json（中文/英文简报）
```

### 4.1 重新抓取/重建

```bash
python3 tools/scrape_gcgx.py        # 抓 26 页 → data/gcgx.json（有缓存，--refresh 强制重抓）
python3 tools/terrain.py --preview /tmp/terrain   # 地形分类预览（人工校对用）
python3 tools/build_scenarios.py    # 生成 config/scenarios.js
```

### 4.2 地图尺寸的坑（已修）

`official-NN.png` 是 GCGX 拼接的官方地图：**16px = 1 格**，但四周常带 8px 装饰边框，
而且每话边框厚度/裁剪方式都不同。旧版本直接 `width/16` 当尺寸，导致 25 话的地图尺寸、
地形和底图全部错位（第 2 话 33×15 被当成 27×21 之类）。

现在 `terrain.py` 的 `content_box()` 会：
1. 从四边逐行/列剥掉「只含边框色」的边；
2. 用内容框宽高 /16 得到真实格数；
3. 若坐标表里有单位超出该范围，退回整张图（第 21、26 话）。

生成时每话还会把**已知站了机体的格子**标记为未知（官方图上画着机体 sprite，会盖住地形），
再从周围做多轮多数投票补全，且优先选可通行地形——否则会出现「单位站在墙里动不了」。

### 4.3 地形分类

按关卡类型分三套规则（地上 / 宇宙 / 基地·要塞），因为三套地形集的配色完全不同：

- 地上：蓝=海、橙=山、浅黄=沙漠、灰白=城市、深绿=森林、黑=外框；
- 宇宙：深蓝/黑=宇宙空间、灰白=要塞/殖民地、橙=陨石、橄榄=月面；
- 基地：**紫色格纹=地板（可走）**、灰白砖墙=墙、橙色=熔岩/岩。

移动消耗用原作表：每种地形 × 空/陆/海 三个值（`TERRAIN.keys[i].move`）。
命中修正只作用于陆/海机体：建筑、山、海、陨石让被攻击方命中 ×80%，空型无视。

### 4.4 CHR 精确地形（v3.1）

从 v3.1 起，地形不再靠配色猜：`tools/rebuild_maps.py` 把官方地图每个 8×8 块与 ROM 的
16,384 个 CHR tile 做**形状归一化匹配**（忽略调色板），得到精确 tile id；4 个块组成一个
16×16 地图格。官方拼接图有 1px 漂移，`chrlib.cell_tile_ids` 对每格做 ±1px 搜索
（第 2 话覆盖率从 6% 提到 92%）。

- 连续 4-tile 组 = 地形（`260..268=plain`、`272=mountain`、`276=sea`、`284=forest`、
  `288=desert` 等），分组→地形表是**人工对照缩略图校对**的（`data/maps-final.json` 的 `groups`）；
- 单位格：先按「非 sprite tile 匹配地形组」，再四邻多数，最后才回退旧配色；
- 输出 26 话 15,941 格，所有单位出生格可通行；`config/scenarios.js` 的 `mapSource: "chr"` 可查。

旧 `tools/terrain.py` 的配色分类只保留作回退与预览；`?maps=ai` 底图仍会与地形格错位，仅供对比。

---

## 5. 引擎架构

### 5.1 数据流

```
config/scenarios.js ──► E.createBattle(scenario)
                              │
                              ▼
                        battle state
                              │
       main.js（输入/动画/相机）┴──► renderer.drawScene / ui.renderAll
```

### 5.2 battle state 关键字段

```js
{
  scenario, map: [][],        // map[y][x] = 地形对象
  cols, rows,                 // 来自 scenario.cols/rows（由官方图内容框推出）
  units: [ { id, key, side, name, pilot, sprite, x, y, level, hp, sp,
             power, armor, speed, move, type, weapons, spirits, buffs,
             acted, moved, alive, escaped, npc, protected, ability,
             expValue, moneyValue, moveFromTurn, leaveTurn, waveIndex } ],
  turn, phase: "player"|"enemy", winner,
  rng, log: [{ key, vars }]，events: [],
  wavesDone: [0, "a1", ...], stats: { kills, attacks, damageDealt, damageTaken, turns, escaped }
}
```

三方势力：`player` / `enemy` / `npc`（中立 NPC，电脑控制，敌人与 NPC 互相敌对；
NPC 不计入我方全灭判定，也不可被玩家操作）。

### 5.3 坐标与相机（★ 最容易改错）

- 一格 `T = 55px`；画布固定 **880×605**（16×11 格视口）
- 地图 16×15 ~ 32×32 不等，因此有相机 `app.cam`（整数格偏移）
- **所有绘制坐标都要减相机**：`drawScene` 里 `g.translate(-cam.x*T, -cam.y*T)`
- **点击命中必须加相机**：`tileFromEvent` 用 `VIEW_COLS/VIEW_ROWS` 换算再加 `cam`
- 相机边界：`clamp(0, cols - 16)` / `clamp(0, rows - 11)`；地图小于视口时居中

### 5.4 底图裁切

`scenario.bg = { x, y, w, h, imgW, imgH }` 是「地图内容框」在官方图中的位置。
`buildTerrainLayer` 按比例把这块裁出来铺满 `cols×rows` 格，所以底图与格子严格对齐。
`hdMapReady` 轮询图片加载，加载完成后重建地形层。

### 5.5 回合、增援与事件

- 第 1 回合的增援在 `createBattle` 里直接调用 `applyWaves(state, 1)`；
- `endPlayerTurn`：敌方 + NPC 行动 → 回合 +1 → `applyWaves(state, turn)` → `beginPlayerTurn`；
- 增援按「第 N 回合开始时登场」，`wavesDone` 用敌方索引与 `"a"+索引` 区分我方/敌方；
- 动作通过 `state.events` 传给 `main.js` 播放动画（move/attack/spawn/escape/leave/victory…）。

### 5.6 胜负条件（数据驱动）

```js
objective: {
  victory: { type: "annihilate" }
         | { type: "destroy", targets: ["ジ・オ"], orAnnihilate: true, turns?: 11 }
         | { type: "escape", exit: "right"|"bottom", turns?: 15, orAnnihilate: true }
         | { type: "survive", turns: 20, orAnnihilate: true },
  defeat:  { type: "annihilate" }
         | { type: "protect", units: ["グレンダイザー"] }
         | { type: "turnLimit", turns: 11 },
  victoryText, defeatText
}
```

- `destroy`：目标机体全部击坠（`__boss__` 表示任意 boss）且没有未登场增援；
- `escape`：飞机关卡，站到 exit 边格按「待机」即离场；所有我方离场（或阵亡）后判胜利；
- `survive`：撑过 N 回合；`protect` 失败条件：保护目标阵亡；
- `turnLimit`：超过 N 回合判负（第 17 话 11 回合、第 21 话 15 回合）。

### 5.7 战斗规则（原作）

- 伤害 = 强度 + 武器攻击力 − 敌方防御（最低 10）；
- 命中 = 速度 + 武器命中 − 敌方速度；陆/海机体乘地形修正，空型无视；
- 速度差 ≥ 50 再攻击一次；
- 反击使用射程内攻击力最高的武器；
- 特殊能力：`間接攻撃無効`（远程伤害 0）、`防御態勢`（受伤 ×0.7）、
  `シールド防御`（×0.8）、`怪電波`（攻击方命中 ×0.7）；
- 数值模型：攻击/防御/速度用档位基准（不随等级膨胀，避免后期伤害触底），
  HP 随话数成长（`1 + (chapter-1)*0.035`）；等级用于显示、经验与击坠价值。

### 5.8 存档

- key：`srw2hd.save.v1`
- 内容：`{ at, scenarioIndex, data: serialize(battle) }`，`serialize` 版本号 `v: 2`
- 保存字段包含 NPC 标记、撤离状态、保护标记、增援索引/登场回合、`ai`、`ability`、
  `moveFromTurn`、`leaveTurn`、`wavesDone`、`jamTurn`、统计等（v1 存档会缺字段，属正常降级）。

---

## 6. 已完成（v3.0）

| 模块 | 状态 |
| --- | --- |
| 26 话数据（真实尺寸 16×15 ~ 32×32） | ✅ 由官方图内容框推出 |
| 官方坐标（allies 232 / enemies 343 / 增援 131 / NPC 4） | ✅ GCGX 全量，含等级/EXP/资金/行动 |
| 敌方增援 / 我方增援 / NPC 生成 | ✅ 按「第 N 回合开始」触发，含第 1 回合 |
| NPC 行动 | ✅ 跟随/攻击最近敌人；第 5 话 3 回合离场、第 7 话开场离场、第 11 话米迪亚固定 |
| 可变地图 + 滚动相机 + 底图裁切对齐 | ✅ |
| 地形（CHR tile 精确）+ 空陆海移动表 + 地形命中修正 | ✅ 26 话 15,941 格，`mapSource:"chr"` |
| 85 台机体数据库 + 名称→立绘映射 | ✅ 80 个 sprite key 全部 HD（12 原有 + 73 AI） |
| 战斗 cut-in（侧面立绘 + 冲刺/跳跃 + 动作 + 伤害数字） | ✅ 80 张侧面战斗立绘，按武器类型播放 11 类动作 |
| 枪口定位（远程从武器/炮口发射） | ✅ 侧面 alpha 找最前手/武器 + 枪管；舰船舰首、炮台炮管 |
| 骨骼动画 / 状态机 / 武器挂载 / 事件 | ✅ root→torso→shoulder→arm→hand→weaponSocket→muzzle；idle/windup/attack/recover；fire/impact 事件 |
| 80 台分层素材 | ✅ 每台 6 主层 + 2 底衬；80 台 / 640 张；逐像素还原原图 |
| 地图按格重建（去除原版烘焙人物） | ✅ 默认手绘奇幻方形 tile；`?map=hd` HD 清图；`?tiles=1` CHR tile |
| 手绘奇幻地图 | ✅ 512 手绘 tile；山/树/岩/城为单个主体，避免密铺看不清 |
| 脚下阴影 / HP 条位置 | ✅ 扁椭圆软阴影；HP 条移到脚边；已行动只显示小勾 |
| 移动/攻击范围可读性 | ✅ 高对比青色填充 + 白色外轮廓 + 呼吸；攻击范围红色加强 |
| 操作手感 | ✅ 攻击后解锁、机体头部/身体可点、悬停不再移动地图、滚轮平移 |
| 回合切换横幅 | ✅ **地图正中**显示「我方/敌方第 N 回合结束」+ 下一阶段；移除底部回合 toast |
| 移动缓动 | ✅ smoothstep 慢-快-慢 + 上下起伏；敌我移动一致，敌方移动有可见时间 |
| 射程校验 | ✅ `doAttack` 播放前硬校验 weaponCanHit；超出射程显示 outOfRange；修理同样校验 |
| 敌方攻击 | ✅ AI 优先选可攻击位；每阶段最多 3 次 quick 骨骼 cut-in（460ms，Boss/击坠强制）；其余地图特效；回归测试验证相邻敌人会扣血 |
| 攻击前摇（举枪瞄准 / 下蹲蓄力） | ✅ 远程瞄准线+准星；近战蓄力+跳跃冲刺 |
| 闪避 / 受击 | ✅ 未命中目标向上闪避 + 「回避」；命中后仰/闪光/震屏/伤害 |
| 战斗动作：光束 / 斩击 / 拳击 / 火焰 / 炮击 / 机枪 / 导弹 / 地图兵器 | ✅ `src/render/combat-anim.js`，20 种武器名全覆盖 |
| 胜负条件（全灭/击坠目标/撤离/坚守/限时/保护） | ✅ |
| 存档 / 继续 / 下一话 / 最终话 | ✅ |
| 中英双语（UI + 日志 + 简报 + 目标） | ✅ `?lang=` + HUD 按钮 |
| 全量剧情台本（28 章 2,497 行，战前播放 + 跳过） | ✅ `data/script-zh.json` / `src/game/script.js` |
| 公共 SDK（埋点 / 域名 / 广告接口） | ✅ `src/sdk/`，缺失自动降级 |
| 音频：3 条录音 + 19 条 NSF + 逐话/BOSS/阶段切换 | ✅ 增益归一化，cut-in 压低 |
| 自动验收 83 项 | ✅ `tests/sweep.py` |

### 验收现状（最近一次）

```
python3 tests/sweep.py
===== 83 passed, 0 failed =====
```

覆盖：启动/简报、26 话逐话加载 + 一回合（无越界/重叠/站墙）、第 2 话增援 6→7、
第 5 话 NPC、第 8/17/21/26 话胜负条件、侧栏攻击/精神/待机、移动后 Esc 撤销、
存档读档保留 NPC、中英切换、移动端 390×844 无横向溢出、`?maps=ai`、BGM 音轨、
SDK、胜利→下一话、最终话不显示下一话、0 控制台错误、0 404；
以及 v3.1 新增：26 话 `mapSource:"chr"`、19 条 NSF 文件齐全、80 个 HD 立绘 key、
28 章剧情台本加载与对话播放；v3.2 新增：20 种武器→动作映射、战斗动作 Canvas 实际绘制。

---

## 7. 当前限制 / 下一步（按优先级）

1. **剧情只有中文**：26 话 + 序/尾声共 28 章、2,497 行已全部中文化，战前自动播放、可点「跳过」；
   英文模式仍只显示简报。要英文化需再翻译 2,497 行（`data/script-zh.json` 已是并行结构）。
2. **AI 立绘是“原创设计”而非原版线稿**：按配色 + 体型（mech/bulky/ship/beast/boss/turret）生成，
   不是逐帧还原原作；战舰/炮台/镜面/导弹已用单独提示词重生成。若要求严格还原，需走 OAM/模拟器截帧。
3. **BGM 是“19 首轮换”**：NSF 19 首按 `(chapter-1)%19` 分配，第 20~26 话回头复用；
   不是原版逐话曲目表（原版具体哪话用哪首未从 ROM 音序器逆出）。循环用 1s 交叉淡化，个别曲有轻微接缝。
4. **AI 只会冲最近**：不使精神、不撤退、不守点；第 7/26 话纯 AI 对打会僵持。玩家操作不受影响。
5. **基地图 wall/floor 边角**：单位格已强制可通行，绝大多数格由 CHR 精确判定；少数混合签名
   （4 个 tile 不构成连续组）回退旧配色，可能和原版差 1 格。
6. **`?maps=ai` 底图与地形格不一致**：AI 重绘底图只作观感对比，地形仍按官方图的 16×16 格。
7. **广告默认关闭**：`src/sdk/sdk.config.js` 的 `ads.enabled=false`，接平台时再开。
8. **`?pixel=1`**：可切换回原版 16×16 CHR 图标（从官方地图提取）；部分敌方图标较粗糙，
   默认走 AI 立绘。
9. **战斗动作是程序化绘制 + 整身位移**：按武器类型做光束/斩击/拳击/火焰/炮击/机枪/导弹/地图兵器；
   侧面立绘是整身冲刺/跳跃/受击回弹，不是逐帧手臂骨骼动画（原作是精灵帧，这里是程序化演出）。
10. **侧面立绘是 AI 生成的一套**：每个 sprite key 一张侧面图，不是原版战斗动画帧；
    少数机体侧面造型与正面立绘不完全一致（例如战舰重新生成过纯舰体）。
11. **闪避方向固定向上**：当前未命中的目标统一向上跳开，没有按攻击方向/站位选择左右或下蹲；
    近战闪避与远程闪避共用同一套位移。
12. **分层 cut-in 的身体层保持原姿态**：80 台都有 head/torso/arms/legs 六层和底衬，逐像素还原已验证；
    但侧面立绘切层紧贴，头部/躯干/腿大幅旋转会露缝，因此默认让身体六层保持原姿，由 root 位移、
    程序化支撑臂/武器和特效承担动作；不是每根肢体独立大幅旋转。
13. **默认地图是手绘 tile 逐格拼接**：同一地形用 1–2 张 512 tile，按格子坐标选变体，仍会重复；
    `?map=hd` 是 HD 清图，`?tiles=1` 是 CHR tile 图集。

## 8. 怎么验收（接手先跑这个）

```bash
python3 tests/sweep.py
```

v3.1 的完整验收记录（指标/截图/复现命令）见 `docs/verification.md`。

调试口：

```js
window.__ll.loadScenario(i)   // 直接加载第 i 话（0-based），返回 {cols,rows,units}
window.__ll.getHud()          // {turn,phase,mode,units,winner,chapter,lang}
window.__ll.forceVictory()    // 测试结算/下一话
window.__ll.endTurn()         // 结束我方回合（Promise）
window.__ll.select(id)        // 选中机体
window.__ll.attack(id, wi)    // 直接攻击
window.__ll.standby()         // 待机
window.__ll.objective()       // 当前话胜负条件文案
window.__ll.setLang('en')     // 切换语言
window.G.app / window.G.ui / window.G.engine
```

---

## 9. 工具脚本

| 脚本 | 作用 |
| --- | --- |
| `tools/scrape_gcgx.py` | 抓 GCGX 26 话攻略 → `data/gcgx.json`（`--refresh` 强制重抓） |
| `tools/chrlib.py` | 共享 CHR 解码/形状索引/1px 容忍匹配 |
| `tools/rebuild_maps.py` | **CHR 精确地形**（26 话）→ `data/maps-final.json`；`--preview DIR` |
| `tools/extract_maps_chr.py` | 早期 CHR 地形探索（qoder agent 版，保留作对照） |
| `tools/terrain.py` | 官方地图 → 配色地形（回退/预览）；`--preview DIR` |
| `tools/build_scenarios.py` | 合并 gcgx + terrain + story → `config/scenarios.js` |
| `tools/optimize_assets.py` | `assets/hd` PNG → WebP(q88) 并清理 `raw/`（约 91MB→26MB） |
| `tools/extract_chr.py` | 从 ROM 解 32 bank / 16384 个 CHR 图块 |
| `tools/extract_scene.py` | 从模拟器截帧裁立绘/地图/地形（需先重录 `/tmp/srw2_emu`） |
| `tools/ucloud_hd.py` | 调优云 GPU 网关做图生图（需 SSH 隧道 19100） |
| `tools/gen_unit_sprites.py` | 批量生成 12 机体 + 5 特效（白底 flood-fill 抠图） |
| `tools/gen_all_sprites.py` | **73 台 AI 机体立绘**（qwen-image → 256 RGBA → WebP） |
| `tools/sync_ai_sprites.py` | 扫描立绘 → `config/sprites-generated.js` 的 `AI_HD` |
| `tools/extract_sprites_lead.py` | 从官方地图 CHR 提取 16×16 原版图标（`?pixel=1` 备用） |
| `tools/render_nsf.py` | NSF 19 首 → 可循环 MP3（libgme + 交叉淡化） |
| `tools/scrape_script.py` | 抓 adventureisland 28 章台本 → `data/script-ja.json` |
| `tools/merge_story_parts.py` | 合并分块翻译 → `data/script-zh.json` |
| `tools/gen_maps.py` / `gen_tiles.py` | 9 套模板 HD 底图 / 9 张地形贴图（**模板方案已废弃**） |
| `tools/hd_map_batch.py` | 26 张官方地图 → AI 重绘（输出 maps-ai） |

GPU 侧（优云 A800）：

```bash
ssh -f -N -L 19100:127.0.0.1:9100 -p 23 root@117.50.187.176
curl -X POST http://127.0.0.1:19100/v1/start -d '{"name":"qwen-image-edit"}'
# 用完 stop
```

---

## 10. 改地图 / 加机体 的操作步骤

**改某话地图**：不要手改 `config/scenarios.js`（会被生成脚本覆盖）。
优先改 `tools/rebuild_maps.py` 的 `GROUP_TERRAIN`（分组→地形）→ 重跑它生成
`data/maps-final.json` → `python3 tools/build_scenarios.py`；配色回退才改 `tools/terrain.py`。

**加机体**：

1. `config/units.js` 的 `UNIT_DB` 加条目（日文原名做 key，`name/sprite/arch`）；
2. 需要 HD 立绘时，放 `assets/hd/units/<sprite>.webp`，并在 `SPRITES` 里标 `hd: true`；
3. 若要新的数值档位，在 `ARCHETYPES` 里加；
4. 重新生成关卡（如果该机体出现在 GCGX 数据里）。

**加一话**：`tools/scrape_gcgx.py` 抓新页 → `data/story.json` 补文案 →
`build_scenarios.py`。地图尺寸/地形会自动处理。

---

## 11. 版权与合规

- 原版 © Winky Soft / Banpresto；本项目为**非官方同人重制**，不得商用。
- 仓库不含 ROM；`games/srw2-web/rom/*.nes` 被 `.gitignore` 忽略。
- 官方地图/坐标来自公开攻略站（gcgx），使用需自行评估。
- 若公开分发，建议只用自绘/自制素材，或要求用户自备原版资源。

---

## 12. 关键参数速查

| 项 | 值 |
| --- | --- |
| 画布 | 880×605 |
| 格宽 | 55px |
| 视口格数 | 16×11 |
| 地图尺寸 | 16×15 ~ 32×32（逐话不同） |
| 存档 key | `srw2hd.save.v1`（`serialize` v2） |
| 语言 key | `srw2hd.lang` |
| SDK 事件 key | `srw2hd.sdk.events` |
| 地图开关 | `?maps=ai` |
| 调试口 | `window.__ll` |
| 服务端口 | 8125（测试脚本会用随机端口） |
| 资源体积 | `assets/hd` ≈ 28MB（含 maps-ai 6MB）；`assets/audio` ≈ 14MB；全站 ≈ 45MB |
