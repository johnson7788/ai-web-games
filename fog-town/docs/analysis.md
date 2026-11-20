# fog-town · 源码分析（改造自《迷雾之町》）

源码路径：`/Users/admin/remake-src/CocosCreator微信小游戏-迷雾之町-源码/zsbyda/`（Cocos Creator 项目）。

## 1. 源码实际形态：3×3 卡牌战斗 + 文字剧情

源码 `assets/Script/` 下共 10 个脚本，核心是 `gm.js`（857 行）。它是一款**卡牌格斗**游戏，不是字面意义上的「迷雾地图探索」：

- **3×3 网格**：`gm.js:5` 的 `weizhi: [cc.Node]` 是 9 个卡槽；主角（`kp_zj`）初始在中央索引 4（`gm.js:101` `obj.zj_sy = 4`）。
- **移动 = 与相邻卡换位**：`btn_kapai.js:67-81` `cz_fanxiang` 用索引差判断相邻（`-3` 上 / `+3` 下 / `-1` 左 / `+1` 右），点击相邻卡触发换位。
- **战斗判定**：`gm.js:268-467` `jisuan_shuju` 按「主角 vs 卡牌」的血量（`sj_xl`）/武器（`sj_wq`）逐分支结算；胜者换位、败者死亡（`gm.js:741-759` `tx_zhansha`）。
- **收集**：金币（`sj_jb`）/御魂（`sj_yh`）/宝箱（`gm.js:410-423`），以及技能武器卡（`gm.js:425-441`）。
- **关卡推进**：每关剩余卡牌数（`Common.js:34` `guanqia_syks = [18,20,...38]`）耗尽后出 Boss（`gm.js:796-828` `pd_bosslx`）；击杀 Boss 进下一关（`gm.js:769-795` `youxi_jq`）。
- **关卡卡组**：`gm.js:75-86` `guanqia1..guanqia11` 是 11 关的卡牌类型序列。
- **文字剧情**：`Common.js:35-179` `guanqia1..guanqia11` 存剧情文本（「龙介 / 迷雾 / 十字路口 / 少女冤魂」），由 `jq_wenzi.js:53-83` 逐句展示、点击翻页。
- **方向箭头**：`jiantou_weizhi.js:31-72` 按主角位置显示可走方向的箭头动画。
- **特殊卡**：`kp_xxbf.js:35-67` 给部分卡换 SpriteFrame 并标血量。

## 2. 迷雾/网格/收集 → spec 的 P0 还原与原创改造

spec（`docs/remake-all/games/spec-fog-town.md`）把「网格移动 + 迷雾主题 + 收集 + 关卡推进」重定义为 **网格地图迷雾探索解谜**，并给出明确的原创改造方向：

| 源码概念 | fog-town 落地 |
| --- | --- |
| 3×3 网格 + 相邻移动（`btn_kapai.js`） | 12×8 网格，方向键/点按相邻格移动 |
| 剧情「白雾茫茫」（`Common.js:44` 等） | 网格迷雾遮蔽，移动逐步揭雾 |
| 收集金币/御魂/宝箱（`gm.js:410-423`） | 收集钥匙（开门）/线索（真相时刻） |
| 关卡推进（`gm.js:769`） | 12 街区推进，每街区目标 + 迷雾布局轮换 |
| 战斗 Boss（`gm.js:796`） | 守卫视线（视线上限）与步数上限构成失败条件 |

## 3. 原创机制（spec 明确要求）

- **灯油**：每步耗油，油尽灯光缩到脚边（`config/gameplay.js` `OIL` / `lightRadius()`）。
- **回声**：静止 1 步可听相邻 2 格机关（`ECHO`，`src/game/sim.js` `doEcho`）。
- **真相时刻**：拼齐 3 条线索全图短暂点亮（`TRUTH`）。
- **三场景包**：暮巷（灰蓝）/集市废墟（土金）/湖畔（青白）（`config/levels.js` `SCENES`，`src/render/theme.js`）。
- **12 街区**：钥匙/杠杆/线索目标 + 迷雾布局轮换（密巷/回廊/守卫视线上限/移动雾区）。

## 4. 决定设计（spec 要求）

- 绕路省油 vs 直穿探雾；回声探机关 vs 硬闯（`config/design.json` `decisions`）。
- 守卫贴边 vs 绕远路；移动雾区凭记忆 vs 回身补探。

（详见 `docs/report.md` 门禁与交付。）
