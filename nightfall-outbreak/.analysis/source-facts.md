# 参考游戏分析 · Deadrise.io（Poki）

`fidelity: C`（仅 4 张用户截屏 + 线上静态文案；WebFetch 只拿到 Poki 壳页标题，读不到 JS 逻辑）
`developer: Gamebole Studios`（线上资料）；`genre: first-person zombie wave shooter`
`reference: https://poki.com/zh/g/deadrise-io`

## 精度限制（必须先说清）

- **能保证**：画面比例、镜头类型（第一人称）、HUD 信息架构、可见文案、控件清单、菜单层级、波次 UI、色板（截屏可量）。
- **不能保证**：移动速度、生成间隔、伤害/血量数值、判定窗口、僵尸 AI 状态机、武器具体参数、波次数值曲线、音频事件表。这些按「FPS 品类基线 + 截图内可见数字」推断，容差只作设计目标，不冒充原作实测。
- 线上第三方文案互相矛盾（有站点写「top-down」，与截图里的第一人称枪模冲突）→ **一律以用户提供的 4 张游戏内截图为准**。
- P0 分层（R-FID-01）：玩法规则 / 数值曲线 / 判定窗口 / 镜头与角色占屏比 / UI 信息架构按截图 1:1 还原；反馈类型与节奏同构；造型 / 贴图 / 文案 / 音色全部原创。

## 证据来源

| 编号 | 来源 | 内容 |
|---|---|---|
| S1 | 截图 1（开屏） | 深紫夜空 + 满月 + 蝙蝠 + 蛛网 + 南瓜灯 + 骷髅；标题 DEADRISE.IO；真实数字百分比 32%；渐变进度条；`Carving pumpkins...`；底部 `CONTROLS WASD Move · Space Jump · LMB Fire · RMB Aim · R Reload` |
| S2 | 截图 2（模式选择） | 三张大卡：STORY MODE（Coming Soon + 锁）、MULTIPLAYER MODE（NEW MODE 红标、默认高亮）、SURVIVAL MODE（43 发步枪图）；左下 Discord 入口；顶部 DEADRISE 红/白双色标题 |
| S3 | 截图 3（战斗） | 第一人称：右下持 M4 风格步枪 + 白色手套 + 前臂；正中绿色十字准星；顶部波次链 1→2→3→4→BOSS（`1` 高亮青色）；`ZOMBIES 2` + 红色长条；左上小地图（圆角圆、绿点=玩家/红点=敌）；右上金币 `0`；右侧商店 `[T]` / 库存 `[6]`；左下绿色圆环 `100 HEALTH`；右下武器槽 `[1]` 与 `30 / 30` 弹药；雾灰绿沼泽、枯树、棕榈、废弃棚屋、火堆 |
| S4 | 截图 4（暂停） | 背景高斯模糊 + 青色描边的横向宽面板；左 `SURVIVAL OPERATION / PAUSED` + 齿轮设置 + Discord；右 `CONTINUE`（青色主按钮，`RESUME` 小角标）、`EXIT TO MENU`、`STORE [F]`、`INVENTORY [B]` |

## 事实表

| 维度 | 结论（证据） |
|---|---|
| 玩法循环 | 选模式 → 第一人称进入封闭场地 → 波次刷僵尸（顶部 1-2-3-4-BOSS 进度）→ 移动/瞄准/射击/换弹清怪 → 波次推进 → 死亡或通关（S2/S3） |
| 交互 | WASD 移动、Space 跳、LMB 开火、RMB 瞄准（ADS）、R 换弹（S1）；`[1]` 武器槽、`[T]` 商店、`[6]` 背包、`[P]` 暂停（S3/S4）；鼠标移动转视角（FPS 品类基线） |
| 判定逻辑 | 屏幕中心准星 + hitscan 即时命中（截图只有固定十字准星，无弹道落下）；`30/30` 弹匣；僵尸有头顶红色发光标记（S3 两只僵尸头顶红光）→ 推断为可击杀/弱点指示；近身攻击扣血（S3 `100 HEALTH`） |
| 动作需求 | 僵尸：idle / walk（蹒跚）/ run（扑近）/ attack / die；玩家：持枪 idle、走路摆动、ADS 抬枪、开火后坐、换弹、受击（均为第一人称手部/武器层，无需全身） |
| UI 结构 | 常驻：准星、左下生命环、右下弹药+武器槽、顶部波次链+敌人血条、左上小地图、右上金币；临时：关卡横幅、击杀播报、受伤红边；面板：主菜单/模式选择、暂停（Continue / Exit / Store / Inventory）、失败结算、商店、背包 |
| 声音 | 截图无音频信息。按品类推断事件表：开火、换弹、空仓、命中肉体、爆头、僵尸嘶吼/低喘、僵尸受击、僵尸倒地、受伤、脚步、波次开始、BOSS 登场、过关、失败、UI 点击；常驻 BGM（战斗推进型）+ 低频环境风/远处火声 |
| 关卡 | 顶部波次链 1→2→3→4→BOSS（S3）：**4 个常规波 + 1 个 BOSS 波**为一章，循环推进；截图只看到 `ZOMBIES 2`，未见机制差异文案 → 标注「原作按波次数值递增，无可见机制差异」；本作按技能关卡规范做成有动词差异的 10 关 |

## 可测量基线（`.analysis/baseline.json`）

| 字段 | 值 | 采集方式 | 精度 |
|---|---|---|---|
| `aspect` | 1.7778 | S3 像素 1000×563 实测 | 可信 |
| `charHeightRatio` | 0.24 | S3 近处僵尸 y≈205→340（135px）÷ 563 | 可信 |
| `groundLine` | 0.52 | S3 远景雾层与地面交界约 y≈292 ÷ 563 | 近似 |
| `moveSpeed` | 620 | 无源码；按 FPS 品类 4.5m/s 折算逻辑坐标 620px/s，做设计目标 | **推断，不保证** |
| `spawnMs` | 1200 | 无录屏；按 `ZOMBIES 2` 小队错峰入场推断 | **推断，不保证** |
| `judgeWindowMs` | 90 | hitscan + ADS 收束窗口的品类基线 | **推断，不保证** |
| `palette` | 见 baseline | S3 取 5 主色（深蓝夜/雾灰绿/雾白/血红/枪口橙） | 可信 |

## 3D 射击参考实现要抄的系统（Step 1 强制）

来源 `references/3d-shooter-template.md` + `references/3D射击DEMO.html`：

| 系统 | 抄什么 | 落在哪 |
|---|---|---|
| 玩家控制器 | pos/vel/yaw/pitch/health + 键鼠/触屏统一输入抽象 | `src/game/player.js` + `src/game/input.js` |
| 武器手感 | recoil（后坐力曲线）/ spread（腰射散布）/ ADS 缓动联动 FOV / muzzle flash / reload / hitscan | `src/game/weapon.js` |
| 敌人 AI | 三类行为（近战犬→蹒跚尸、飞行鸥→扑击尸、无人机→BOSS 远程）+ 巡逻/追击/攻击状态机 | `src/game/enemies.js` |
| 波次 | 远点刷新 + 错峰入场 `spawnStagger`，避免扎堆 | `src/game/waves.js` |
| 画面「伪 3A」 | 光照三层（环境 PMREM + 带软阴影主光 + 体积雾光柱）、程序化噪声材质、AgX/ACES 调色 → bloom → 色差/暗角/颗粒、画质三档 | `src/art/render.js` |
| 音效 | WebAudio 实时合成：噪声 buffer + 振荡器 + 滤波链（`rifle_shot` 是现成参考） | `src/core/audio.js` |
| 性能 | `InstancedMesh` 摆场景、DPR 自适应、半分辨率特效 | `src/art/world.js` |

**不抄**：DEMO 的中文硬编码文案、内联压缩 three.js、港区题材着色、无 SDK/无域名锁/无开屏的裸奔形态。

## 玩法映射（Step 2 展开）

| 参考机制 | 本作做法 | 差异理由 |
|---|---|---|
| 模式选择三卡 | 保留三卡信息架构，改为 SURVIVAL / OPERATIONS / NIGHTMARE 三个可玩入口 | 不做「Coming Soon 锁卡」糊弄玩家，也不做真多人联机（无后端） |
| 4 波 + BOSS 进度链 | 保留 1-2-3-4-BOSS 顶部波次链；做成 10 关战役，每关一个动词 | 技能关卡规范要求动词级多样性，不能只是加数量 |
| WASD / Space / LMB / RMB / R | 全保留；补充键盘转向（无指针锁时可用）与触屏双摇杆 | 浏览器 H5 触屏必须可玩 |
| 30/30 弹匣 + 换弹 | 保留；加入 ADS 收束、后坐力、空仓咔哒 | 手感是 FPS 的核心 |
| 小地图 / 生命环 / 金币 / 商店 / 背包 | 全部保留信息架构，原创视觉（青灰战术 UI） | P0 UI 信息架构 1:1 |
| 僵尸红光头顶标记 | 改为「弱点核心发光」原创设定 | 造型原创 |
