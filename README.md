# games

个人游戏合集仓库。每个目录是一款可独立运行的网页游戏（少数为引擎工程），
绝大多数**零构建、零运行期依赖**，起一个静态服务器即可玩。

| 目录 | 游戏 | 类型 | 中文名 |
| --- | --- | --- | --- |
| [`srw2-web`](srw2-web/) | 第2次超级机器人大战 · 网页版 | FC 模拟器 · 战棋 | 超级机器人大战2 |
| [`srw2-hd`](srw2-hd/) | 第2次超级机器人大战 HD | 战棋 · 高清重制 | 超级机器人大战2 |
| [`red-fortress`](red-fortress/) | RED FORTRESS | 俯视载具射击 | 赤色要塞 |
| [`paw-brawl`](paw-brawl/) | PAW BRAWL | 3D 派对格斗 | 爪爪大乱斗 |
| [`stickman`](stickman/) | LAST LINE | 横版射击 · 火柴人 | 最后一笔 |
| [`windup-kid`](windup-kid/) | WIND-UP KID | 2.5D 平台跳跃 | 发条小子 |
| [`neon-drift`](neon-drift/) | NEON DRIFT | 3D 竞速 | 霓虹漂移 |
| [`cocos3d激战突围`](cocos3d激战突围/) | 激战突围 | 跑酷 + 射击 + 合成 | 激战突围 |
| [`gravity-golf`](gravity-golf/) | GRAVITY GOLF | 体育 · 弹道 | 重力高尔夫 |
| [`eight-ball`](eight-ball/) | EIGHT BALL CLUB | 体育 · 台球 | 八球俱乐部 |
| [`screw-puzzle`](screw-puzzle/) | SCREW OUT | 益智解谜 | 螺丝出逃 |
| [`mahjong-solitaire`](mahjong-solitaire/) | MAHJONG SOLITAIRE | 棋牌 · 接龙 | 麻将接龙 |

游戏都可以在这体验:
https://pipygames.com/

> 最后四款（gravity-golf / eight-ball / screw-puzzle / mahjong-solitaire）为 2026-11-12 新建，
> 2026-11-13 已上架 pipygames（单玩法版）：
>
> - [GRAVITY GOLF](https://pipygames.com/games/gravity-golf-free-physics-golf-game-elqk)
> - [EIGHT BALL CLUB](https://pipygames.com/games/eight-ball-club-free-browser-pool-game-zmqp)
> - [SCREW OUT](https://pipygames.com/games/screw-out-free-screw-puzzle-game-gjd7)
> - [MAHJONG SOLITAIRE](https://pipygames.com/games/mahjong-solitaire-free-classic-tile-game-75zy)

---

## 通用运行方式

网页游戏都是 ES Module + `fetch()`，必须走 HTTP（`file://` 直接打开会失败）：

```bash
cd <游戏目录>
python3 -m http.server 8124
# 浏览器打开 http://127.0.0.1:8124/
```

各游戏可用 `?lang=zh` / `?lang=en` 切换语言（多数支持中英或更多语言）。

---

## 各游戏介绍

### srw2-web — 第2次超级机器人大战 · 网页版

1991 年 FC 卡带《第2次超级机器人大战》在浏览器里重新点火：**原版 ROM + FCEUmm 运行时**，
像素级重开，不是重制。玩法、数值、剧情、敌方 AI 与 1991 年完全一致。

- 品类：战棋 SRPG（模拟器外壳）
- 3 个即时存档槽、18 篇内置中文攻略、CRT 扫描线、手机竖屏 + 虚拟手柄
- ROM 需自行准备（`.nes`，mapper 74），也可 `?rom=<url>` 指定

### srw2-hd — 第2次超级机器人大战 HD

同一款游戏的高清重制：**原版关卡、原版剧情、原版规则**，用矢量美术与现代界面重新演绎。
从 ROM 逆向地形与剧情，AI 高清化立绘，Canvas 战棋 + 骨骼动画 + 战斗演出状态机。

- 26 话地图、80 台机体、19 首 NSF 音轨、全中文剧情台本
- 地形 tilemap、骨骼动画战斗（风车/军刀/爆风）、阶段横幅

### red-fortress — 赤色要塞 RED FORTRESS

俯视卷轴载具射击。开吉普冲进敌军要塞，用机枪和手雷撕开防线，
把战俘排成一串带回停机坪——救得越多火力越猛。

- 救人即火力：交付战俘 → 加分、加手雷、回装甲、里程碑升级
- 4 关 × 3 命、两场 Boss、关间三选一改装、中英双语

### quiz-rush — QUIZ RUSH

霓虹综艺舞台上的快问快答：10 题、3 条命，连对触发 **OVERDRIVE** 双倍得分。

- 3 档难度（新手 / 职业 / 传奇）、连击计分、奖牌与成就
- 支持 6 语言（英 / 中 / 日 / 韩 / 阿 / 俄）

### paw-brawl — 爪爪大乱斗 PAW BRAWL

原创 3D 动物派对格斗。八只动物在悬浮擂台出拳、抓取、投掷、捡道具；
支持大乱斗、4v4 团队战、三张轮换地图、角色解锁、金币存档与**在线联机**。

- 8 角色（柴犬 / 猫 / 兔 / 熊猫 / 熊 / 狐狸 / 青蛙 / 鸭）
- 直连联机（4 位房间码 + 机器人补位 + 断线重连）
- 全部美术与音频由代码生成，运行时零外部请求

### stickman — LAST LINE 最后一笔

画在纸上的 ragdoll 火柴人射击。墨就是你的血，每一枪的后坐力都把你推向反方向。

- 5 幕 5 种画风（草稿 / 蓝图 / 霓虹 / 水墨 / 留白）、12 波次、3 把笔、16 种升级、三阶段 Boss、双结局
- 后坐力位移是核心机制：空中连发即可「用后坐力飞起来」

### windup-kid — WIND-UP KID 发条小子

2.5D 横版平台跳跃（马里奥品类）：玩法是 2D（AABB × 瓦片碰撞、60Hz 定步长），
画面是 3D（three.js + 三层视差背景）。灰盒阶段，物理与手感测试齐备。

- 分层纸偶角色、跑跳手感（土狼时间 / 跳跃缓冲 / 可变跳高）、火焰形态

### neon-drift — NEON DRIFT

3D 霓虹街机竞速：自动加速 + 一键漂移 + 漂移攒氮气，单圈约 30 秒。

- 3 条主题赛道（都市 / 戈壁 / 沿海）× 3 款跑车、幽灵车同场、单圈成绩本地存档


- 纯全局脚本零构建，桌面 HIGH / 移动 LOW 画质自适应

### cocos3d激战突围 — 激战突围

Cocos Creator 3.6.1 移动端工程：跑酷 + 射击 + 合成突围的休闲手游。
控制角色小队边跑边射击、拾取道具、合成强化，闯关突围。

- 需要 Cocos Creator 编辑器打开（非静态网页）
- 完整手游框架：签到 / 转盘 / 关卡 / 复活 / 奖励 / 广告与 SDK 接入

### gravity-golf — GRAVITY GOLF 重力高尔夫

侧视弹道高尔夫：拖拽定角度、按住蓄力、松手击球，球在六颗重力不同的星球上飞出、弹跳、停下。

- 距离换金币，金币升 4 条线（力度 / 弹性 / 幸运 / 旋转）；每 3 杆换一颗星球（月/火/冰/熔岩/气态/星环）
- 签名记忆点：击球后球手被后坐力甩飞，ragdoll 翻滚着追球，停球后才落地
- 速度阈值烧蚀：太快会起火甚至烧毁，逼「更远 vs 更稳」取舍
- 无限距离挑战单玩法；同 seed 同轨迹，纯逻辑 13 条测试

### eight-ball — EIGHT BALL CLUB 八球俱乐部

单人 8 球：一张标准台、一名 AI 对手（业余 / 俱乐部 / 职业三档）。

- 拖拽瞄准 + 力度条、幽灵球预测线、自由球拖放、犯规判定、花色分组、8 号胜负
- AI 枚举「目标球 × 6 袋」ghost ball 线路，按难度加误差，无解打安全球（不会卡死）
- 物理：等质量弹性碰撞 + 库边衰减 + 摩擦停止 + 袋口喇叭区；22 条纯逻辑测试
- 移动端 HUD 与台面分区（不压木框与袋口）

### screw-puzzle — SCREW OUT 螺丝出逃

拆螺丝解压解谜：点螺丝拧出（棘轮音 + 旋转飞出），板失去支撑就掉落，拆光所有板过关。

- 30 关、2–5 层板、横长/竖高/方阵三种轮廓；被上层板遮挡的螺丝会锁住
- 拉丝金属板 + 铆钉 + 投影 + 车间尘埃；拧出 540°、落地烟尘与 2px 震屏
- 星级按用时计，总星数存档；13 条纯逻辑测试

### mahjong-solitaire — MAHJONG SOLITAIRE 麻将接龙

经典乌龟布局 144 张牌接龙：点两张都自由且同面的牌消掉，消光获胜。

- 自由判定（左右无牌、上方无压牌）、花牌互配、提示 / 撤销 / 洗牌各有限次
- 反向剥离发牌，**每局保证有解**；洗牌后仍保证有解
- 牌面全部 Canvas 程序化（筒/条/万/风/箭/花），零外部图片
- 计时 + 星级结算；15 条纯逻辑测试
