# PENTA CARDS · 源码侦察（H5卡五星 → 原创星象牌桌）

> 源码：`/Users/admin/remake-src/H5卡五星-creator/`（Cocos Creator 联网麻将房游戏，客户端 `client/` + 大厅 `kwx_server/hall_server/` + 牌局服 `kwx_server/majiang_server/` + 代理 `dealers/`）。
> 结论：这是湖北「**卡五星**」3 人麻将，**联网房间类**——按 spec 指示剥离联网，做**单机 vs 2 AI**，核心牌规则 1:1 还原。

## 1. 牌与人数

- 3 人：`gamemgr_kwx.js:23` `exports.numOfSeats = 3`。
- 84 张牌（`gamemgr_kwx.js:25-60` shuffle）：**筒 1-9 ×4**（id 0-8）、**条 1-9 ×4**（id 9-17）、**中/发/白 ×4**（id 27-29）。**无万、无风**。中发白即「三元」。
- 牌 id 编码由 `mjutils.js:222` `getMJType` 确认：0-8 → 类型 0，9-17 → 类型 1，≥27 → 类型 3。

## 2. 发牌与回合

- 每人 13 张、庄家再摸 1 张成 14（`gamemgr_kwx.js:201-225` `deal`）。
- 回合循环：摸牌 → 检查暗杠/弯杠/自摸 → 弃牌 → 其余两家检查碰/杠/胡（`chuPai` `gamemgr_kwx.js:1943-2032`；`peng` `:2034`；`gang` `:2321`；`hu` `:2389`）。
- 碰：`gamemgr_kwx.js:2034-2118`；杠分暗杠/点杠/弯杠（`doGang` `:2165-2263`）；胡分自摸/点炮（`hu` `:2389-2573`）。

## 3. 胡牌判定（核心还原）

`mjutils.js`：
- `checkCanHu`（`:199-220`）：选一对「将」，其余按 3N 规则拆。
- `checkSingle`（`:151-197`）+ `matchSingle`（`:46-149`）：递归尝试刻子/顺子；`matchSingle` 对 id≥27 直接返回 false（三元不能成顺），顺子靠 `%9` 自然挡 8→9 越界。
- `checkTingPai`（`:2-35`）：逐张加牌试胡，生成听牌表。

七对 / 对对胡在 `gamemgr_kwx.js:395-488` `checkCanTingPai` 单独判定：七对（`pairCount==6`，番 2）、对对胡（`singleCount==0 && pairCount==2` 或 `singleCount==1 && pairCount==0`，番 1）。

## 4. 番型与分数（`gamemgr_kwx.js:800-866` `getFan` / `:887-1395` `calculateResult`）

- 基础番：平胡 0 / 对对胡 1 / 七对 2。
- 加番：清一色 +2、大三元 +3、小三元 +2、**卡五星 +1**（`sykwx` 玩法 +2）、明四归 +1、暗四归 +2、手抓一 +2、杠开/杠上炮/抢杠 +1、明牌 +1、海底 +1；七对另按龙七对/双龙/三龙/三元七对加番。
- **卡五星**（`mjutils.js:330-359` `checkKaWuXing`）：胡的那张是 **5 筒（id 4）或 5 条（id 13）**，且手牌持有 4 与 6（夹张），凑成 4-5-6 顺子，余牌可胡。
- 分数 = `2^fan × baseScore`（`computeFanScore` `:745-751`），封顶 `maxFan`。
- 自摸收两家、点炮收放炮者（`calculateResult` `:1130-1212`）；杠有即时结算（`doGang` `:2207-2235`）。

## 5. 联网剥离与原创改造（本作决策）

- 原作为 socket 房间 + 房主创建 + 托管续局（`room_service.js` / `client_service.js` / 客户端 `MJRoom.js` / `MJGame.js`），全部剥离；换成本地 `src/game/sim.js` 状态机 + 2 名启发式 AI。
- 只保留核心：3 人、84 张、摸打碰杠胡、番型 2^fan 结算、卡五星 signature。
- 原创区别点（spec）：
  1. **观星**：每局 2 次看牌堆顶 3 张（`ABILITY.stargaze`）。
  2. **换星**：每局 1 次弃 1 换 1，且对手可见（`ABILITY.swap`）。
  3. **星阵连线**：胡牌瞬间星线串联成牌（render 的 `view.constellation`）。
  4. 三场景包：观星台（蓝金）/ 茶室（暖褐）/ 极光（青紫），12 局换 3 章（`config/rules.js` SCENES）。
- 兜底判断：源码规则清晰完整，无需退回 spec 的「简化五星钻」，但**未实现**原作的明牌/漂钱/买马/换三张/荒庄查叫等房规，记录于此。

## 6. 数值映射（本作 config/rules.js）

| 源码 | 本作 |
| --- | --- |
| 筒 0-8 | 星 1-9（星宿） |
| 条 9-17 | 轨 1-9（星轨） |
| 中发白 27-29 | 日/月/斗（三元） |
| 卡五星 id 4 / 13 | 五星 / 五轨（`KAWUXING_TILES=[4,13]`） |
| baseScore | 底注 `baseBet`（1→4 随 12 局递增） |
| maxFan | `MAX_FAN=8` |
| 3 真人 | 玩家 + 2 AI（`AI.aiSkill` 0.25→0.9） |
