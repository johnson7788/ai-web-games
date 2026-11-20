# 源码分析 — tycoon-empire

> 改造来源：`/Users/admin/remake-src/顶级富豪/顶级富翁-creator/`（核心经营玩法）+ `/Users/admin/remake-src/大老板/game-globaltravel-main/`（点击产出/收益格式化）。
> 原则：玩法规则 1:1 还原，角色/场景/音乐/IP 名全原创。

## 1. 顶级富豪（Cocos Creator，主要参考）

### 1.1 核心循环：楼层（店铺）→ 产出 → 升级 → 经理自动化

- 店铺/产业数据在 `assets/resources/conf/ResourceList.json:202-271` 的 `floorLevelList`：
  - `cost`（开店成本，0 / 58.5 / 877.5 / … 逐级几何增长）
  - `profit`（每次产出，1 / 50 / 450 / …）
  - `profitTime`（产出周期秒数，2 / 3 / 6 / 12 / 24 / …）
  - `costPer`（升级成本增长系数 1.07–1.15）
  - `level`（升级经验门槛 10 / 30 / 80 / 180 / 280）
- 10 个店铺牌照在 `assets/resources/conf/LicenseInfoList.json`（书店/餐厅/服装店…）。
- 里程碑成就在 `assets/resources/conf/AchieveList.json`（target/num/rNum 结构）。
- 大数单位缩写表在 `assets/resources/conf/UnitList.json`（`"" / K / M / B / T / AA / AB …`）。

### 1.2 关键逻辑（`assets/Script/GameLogic/BuildingManager.js`）

- `openFloor(idx, type)`（:167）：判断现金够不够开店，扣钱后写 `myFloors` 存档并 `openShop`。
- `countFloorCost(idx)`（:393）：开店成本，按 `worldId` 乘 8/32/96/192 难度系数。
- `countProfit(idx)`（:417）：产出 = `profit[idx] * (等级+1)` × 管家加成 × 里程碑 `2^totalLevel` × 声望加成；经理类型分「爆发/加速/减费」三类。
- `countProfitTime(idx)`（:592）：产出周期随楼层等级 `* 0.5^level` 递减。
- `countTrainConsume(idx, lv)`（:622）：升级成本 = `baseCost * costPer^(lv-1)`。
- `countBatTrain(idx, num)`（:645）：批量升级累计成本。
- `closeShop(idx)`（:280）→ `getProfit` 把产出加进现金。
- `managerOpenJudge(idx, profit)`（:300）：**有经理自动重新开店（自动化），无经理则挂「营业中」等玩家手动点**。
- `countOfflineProfit()`（:102）：离线收益按 `countProfit/countProfitTime` 累计、按经理有无决定是否全额，再 ×0.1 结算。

### 1.3 货币/存档（`assets/Script/GameLogic/Player.js` + `GameApplication.js`）

- `Player.itemArrayAdd/Get/Set`（:479-567）：统一读写 `pCurrency`（0=钱）、`pScore`、`pAchievement` 等数组。
- `GameApplication.countUnit(num)`（:553）：大数缩写（`$1.23K` 风格）。
- 存档走 `DataManager`（`GameLogic/DataManager.js`），本地 `cc.sys.localStorage` + 远端 SDK 双写。

### 1.4 结论：可还原的规则

1. 点击/开店产出、买店成本曲线、升级效率曲线、经理自动化、里程碑解锁、总资产、离线收益——全部有明确数值模型。
2. 本作改造为「点击主资产产出（大老板的点击）+ 12 产业里程碑（顶级富豪的楼层）」的混合形态。

## 2. 大老板（Cocos Creator，辅助参考）

- 点击产出/收益 UI：`assets/scripts/hall/game/IncomeCoponent.ts`（`total_speed_num`、`can_use_num`、`this_income_num`、`total_income_num` 四个指标）。
- 大数格式化：`assets/scripts/hall/CalcTool.ts:produce(power)`（K/m/B/T/a/b/… 齿轮缩写）与 `formatNum(formatNum)`。

## 3. 本作改造映射

| 原规则 | 本作实现 |
| --- | --- |
| 楼层开店 `openFloor` | `doBuy`：12 产业顺序解锁、买下解锁下一产业 |
| 产出周期 `profitTime` | 连续产出（每秒 pending/现金），经理自动收取 |
| 升级 `countTrainConsume` | `doUpgrade`：`cost * costGrowth^level` 几何成长 |
| 经理自动化 `managerOpenJudge` | `doHire`：无经理产出进 pending 需手动收，有经理自动进现金 |
| 里程碑 `2^totalLevel` | `buildingUp`：产业等级翻倍触发「金链落成」动画 |
| 离线收益 `countOfflineProfit` | `applyOffline`：`总速率 × 离线秒 × 0.5`（≥60s 才结算） |
| 大数缩写 `countUnit` | `formatMoney`（K/M/B/T/AA…） |

## 4. 原创差异化（spec 要求）

- **签名记忆点**：产业等级每次翻倍，金链从楼底窜到楼顶落成、大楼升层、全屏金色粒子。
- **股市日**（区别点 1）：每 30s 一个行情日，随机产业 ×2 或 ×0.5；「All In」按钮把全部现金押涨/跌，押中 ×2、押错 ×0.5。
- **贷款**（区别点 2）：借 10 倍现金，每 60s 利息 5%；现金付不起利息即破产，产业清零重开。
- **三场景包**：街角（暖）/ 市中心（金）/ 金融塔顶（蓝紫），按产业里程碑章节切换。
- **12 产业里程碑**：报刊亭→洗衣店→餐馆→电台→剧院→报社→百货→汽车厂→航运→铁路→石油→国际银行。
