# quiz-sprint 源码分析（改造自 答题冲冲）

> 源码：`/Users/admin/remake-src/答题冲冲-creator-联网/`（Cocos Creator 2.x + ws 联机）
> 原则：玩法规则 1:1 还原核心循环；角色/场景/音乐全原创；单机化 + 原创改造。事实均带 文件:行号。

## 1. 原版是什么

一款**联机竞速答题淘汰赛**。玩家加入房间匹配（最多 10 人 / 18 座位），每局 10 题。
每题是一个「是/否」判断题（`answer: "yes" | "no"`），玩家选「对」或「错」决定站到赛道左侧/右侧；
答题时间结束，正确答案一侧是安全区，答错一侧会从下方冒出一道障碍物（无底洞/猛犸）撞飞答错者。
答错的玩家被淘汰，最后幸存者/剩者为胜。

## 2. 入口 → 主循环 → 输入 → 判定 → 关卡 → UI

### 入口与流程
- `assets/Script/Login.ts` + `UI/MainUI.ts:39` `clickGo()` → `Server.Instance.send(SERVER_EVENT.JOIN)` 加入房间。
- `Server.ts:46-51` `_onOpen` → 发 `GAME_LOGINGAME`；收到 `HI` → 0.7s 后 `loadScene("Game")`（`Server.ts:57-62`）。
- `Game.ts:104-115` `_onJoinSuccess`：滚动背景起、显示"加入成功"、进入匹配倒计时。

### 主循环 / 题目节奏
- 服务端 `entities/room.ts` 是真正的规则中心：
  - `ADD_ROBOT_AFTER=10000`（匹配 10s）、`GAME_TIME=8000`（每题 8s）、`TOTAL_TITLE=10`（每局 10 题）。
  - `room.ts:112-133` 匹配倒计时结束，人数>1 才开局（否则 `MATCH_FAILED`）。
  - `room.ts:258-290` `_playGame()`：随机选障碍物（按 `ran` 权重）→ 广播 `NEXT`（含题目 id、8s、障碍物）→ 开 8s 答题倒计时。
  - `room.ts:301-313` `_updateNextTitle()`：8s 到 → 下一题（间隔 6s）或 `_finishGame()`。

### 输入（选项）
- 客户端只有两个按钮 yes/no：`Game.ts:175-197` `onClickEvent`，`_canChoose` 防连点，发 `SERVER_EVENT.CHOICE`。
- `GameChoice.yes=0 / no=1`（`GameData.ts:20-23`）。
- 服务端 `player.ts:55-66`：`CHOICE` → `movePlayerToLeft`（yes）/ `movePlayerToRight`（no）。

### 判定（对错 = 站哪边）
- 座位坐标 `PlayerManager.ts:91-109` `_getPosByIndex`：index<9 → x=-320..-120（左列）；index>=9 → x=120..320（右列）。
- `leftSide = pos.x < 0`（`PlayerManager.ts:63`）。
- 题目答案 `ITitle.answer`（`Constants.ts:54-63`，仅 4 道硬编码：西瓜肉红?yes / 苹果肉紫?no / 1+1=2?yes / 2x4=9?no）。
- 障碍物生成 `ObstacleManager.ts:18-27`：`dir=="yes"` → x=200（右侧）；`dir=="no"` → x=-200（左侧）。
- 答对者站答案**另一侧**（yes 站左、no 站右），答错者站答案同侧被撞。
- 判定错者 `PlayerManager.ts:143-154` `getSelectWrongPlayers(dir)`：
  `(dir=="no" && leftSide) || (dir=="yes" && !leftSide)` → 记入 `allWrongPlayers`。

### 淘汰
- `Obstacle.ts:27-52`：障碍物 `node.y += speed`（speed=10）上移，碰撞框叠玩家 → `player.scaleToZero()` → `Game.checkSendGameOverEvent`。
- `Game.ts:134-155`：全员答错清点，3s 后停滚动、发 `OVER`、玩家 `moveOutside`，2s 后回 `MainUI`。

### UI
- `TopicBar.ts:106-124`：题目大字 + 倒计时（绿=匹配/橙=答题）+ 「第 N 题」tip。
- `ScrollingBg.ts:21-33`：两张背景图循环向上滚动（跑步感）。
- `Player.ts:50-57`：淘汰时 `moveOutSide()` → `node.y -= 10` 直到屏幕外销毁。

## 3. 原版核心循环（要 1:1 保留的规则）

1. **赛跑 + 答题**：答对前进（站到安全侧），答错原地/被撞（淘汰）；对手（联机真人）同步在跑。
2. **计时每题**：每题限时，超时按答错处理。
3. **题库分类**：题目带答案，对错二选。
4. **到达终点名次**：多人淘汰决名次。

## 4. 原创改造映射（spec 要求）

| 原版 | quiz-sprint 改造 |
| --- | --- |
| 是/否二选 + 站边躲障碍 | 4 选 1 选择题，答对冲刺前进 / 答错原地或后退（单机化，无淘汰） |
| 联机真人对手 | 3 个 AI 对手按各自速度跑 |
| 10 题淘汰制 | 12 赛（关卡）：距离递增 + 类别轮换 + AI 速度递进 |
| 硬编码 4 题 | en/zh 各 ≥120 题（常识/科学/地理/体育），config/quiz.js |
| 无连击 | 连击加速带；**5 连对触发「学霸冲刺」残影**（signature） |
| 无赌注 | **赌注题**：每 5 题一次双倍题，先看类别再决定「答/跳过」 |
| 无体力 | **体力条**：答错掉体力、答对回体力、体力空则降速 |
| 单场景滚动 | **三场景包**：晨跑（亮）/ 山道（绿）/ 夜城（霓虹），换章必换色板+构图+装饰 |

## 5. 结论

- 核心循环 = 「读题 → 计时内选答案 → 答对冲刺/答错退 → 到终点排名次」。
- 单机化后把「淘汰」改为「名次结算」；把「站边躲障碍」简化为「答对前进/答错后退」；
  保留计时、题库分类、竞速对手、终点名次四要素。
- 数值、关卡、题库、文案全走 config/（config-first），逻辑层不写死。
