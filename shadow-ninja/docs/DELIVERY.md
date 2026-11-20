# Shadow Ninja Cat · 交付说明

> 改造自 Cocos 源码 `local/src1/MiniNinjiaCat-creator/MiniNinjiaCat/assets/src/`（忍者猫跑酷）。
> 只读参考：`games/oasis-pipeworks/`（黄金参考实现）。只写 `games/shadow-ninja/`。

## 1) 源码分析摘要（原作玩法事实）

原作是**横版自动跑酷**（不是动作闯关）：地图自动左移、猫自动前奔，玩家只控制跳跃与绳索。

| 事实 | 出处（文件:行号） |
| --- | --- |
| FSM：menu → play → `GameScene.create(roleId, mapId)`，角色/地图取已解锁最高档 | `game/MyGame.ts:79-99` |
| 地图按 6 档速度循环重复生成，`SpeedXArray_Release = -15..-33 × 35` | `game/ui/entity/GameMapApi.ts:6-9` |
| 块宽 `BlockWidth = 100`，`getBuilding(idx)` 返回地形（0 空 / 1 地面 / 2 塔） | `GameMapApi.ts:16,88-95` |
| 玩家状态机：LAND / SKY / SWING / ROLL / FLY / DEATH | `game/ui/entity/Player.ts:18-39` |
| 点击 = 跳（Run→jump），空中再点 = 发射爪绳（Jump→fire），松手/收绳 = 滚落（roll） | `Player.ts:540-552,562-569,571-657,665-670` |
| 跳跃 `_speedY=32`，滚动 `_speedY=32`（向下），俯冲/贴地 | `Player.ts:562-570,665-670` |
| 金币三档：铜 +1 / 银 +10（同组集齐再 +50×数量）/ 金 +1000；双倍道具 ×2 | `Player.ts:984-1009` |
| 金钱换算：`localGold = money / 100 / 100`（10000 铜 = 1 金） | `game/data/GameData.ts:103-107` |
| 结算 `syncData`：本局金币入库 + 累计距离 + 单局最远 + 自我超越 + 局数 | `GameData.ts:148-165` |
| 复活价 `revivePrice = 20`（卷轴） | `GameData.ts:37` |
| 开局 4 秒倒计时 | `game/ui/widget/CountDownWidget.ts:55-73` |
| 道具三型：FLY(竹蜻蜓，冲刺无敌) / COLLECT(吸金石) / DOUBLE(双倍金币)，各 10 级持续 4-13s | `game/const/PropType.ts:1-5`、`lib/allInfos.js:88-328` |
| 商店定价表：竹蜻蜓 20 / 吸金石 10 / 双倍金币 15 卷轴；角色「服部半藏」70、场景「樱花城」70（金币 +5%） | `lib/allInfos.js:346-652` |
| 成就 7 类各 4 档：累计金币 / 单局最远 / 累计距离 / 局数 / 自我超越 / 竹蜻蜓次数 / 道具总次数 | `lib/allInfos.js:7-82`、`game/const/AchievementType.ts:1-13` |
| 金币三档类型枚举 | `game/const/CoinType.ts:1-7` |

**核心循环**：自动跑 → 点跳 → 空中再点甩爪绳悬挂/二段 → 收绳滚落 → 撞塔/坠坑死 → 复活或结算 → 攒金币/卷轴 → 商店买角色/地图/道具。

## 2) 改造点清单

**保留（1:1 抽数值还原）**
- 横版自动跑 + 跳跃 + 空中俯冲（原作「跳 → 滚落」简化为「跳 → 俯冲」）。
- 金币三档经济：原作铜/银/金 → 本作「风铃」单一货币（风铃=金币），`moneyMultiplier=100` 的三档结构保留在数值上（shop.js 定价 1:1 映射）。
- 商店 8 件（≥6）：斗篷/爪钩/铃铛（永久能力）+ 竹蜻蜓/吸金铃/双倍铃/还魂铃（消耗）+ 月影披风（外观）。
- 成就 7 类各 4 档，阈值 1:1 取自 `allInfos.js:7-82`。
- 开局倒计时（原作 4s → 本作 3s，含 GO）。
- 复活机制（原作卷轴 → 本作风铃/还魂铃/激励视频降级）。
- 12 关推进、三星结算、金币持久化、关卡解锁、失败保留已收风铃。

**原创改造（不换皮的理由）**
- **主题**：忍者猫 →「影武喵」——屋顶夜行的剪影猫，金币 = 风铃，场景 = 暮色瓦海 / 雨夜横町 / 月下竹林。
- **签名记忆点**：夜行时猫身只余剪影 + 金色风铃尾迹（render 的 `drawCat` 金色尾迹 + 纯黑剪影）。
- **操作**：点按/空格跳、↓ 俯冲；道具快捷键 1/2/3；触屏 tap 跳、下滑俯冲。
- **规则升级**：斗篷=二段跳、爪钩=超跳（跳高 ×1.32）、护身铃=开局护盾——把原作「买皮肤/买地图」的纯数值换成改机制的装备。
- **关卡新元素**：追击犬（加速区间）、高低双层（悬浮平台奖励）、风铃链、夜雾、滑索、密集陷阱、宽沟、终章叠加。

## 3) 门禁最终输出摘要

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 纯逻辑测试 | `node --test` | ✅ 23 pass / 0 fail |
| 自对弈遥测 | `node tools/selfplay.mjs` | ✅ greedy 3 关 3 星通关（57s/156 动作/164 apm），random/noinput 各死 1 次 |
| 设计审计 | `fun-audit.mjs` | ✅ PASS（12 关/10 升级/规则型 60%/重玩钩子 4） |
| Fun Gate | `fun-report.mjs` | ✅ PASS（首输入 5s / 首胜 18s / 空转 0% / 事件间隔 1s / 事件 8 种 / 推进率 100% / 死亡 67%） |
| 浏览器验收 | `verify-game.mjs` | ✅ 60fps、0 console/page error、0 失败请求、7 张截图全过 |
| 语言完整性 | `i18n-check.mjs` | ✅ en/zh 各 61 key、0 缺失、0 空值 |
| 首次交互引导 | `tutorial-check.mjs` | ✅ 3 步（jump/dive/collect）、可跳过、持久化、可重看 |
| SDK 接入 | `sdk-check.mjs` | ✅ 对象存在、API 齐全、降级可玩、0 error |
| 音频验收 | `tools/audio-check.mjs` | ✅ BGM 40s 无缝循环 + 14 个 SFX 全过 RMS/时长/峰值 |
| 视觉评审 | `vision-review.mjs` | ✅ PASS（readable 8.1 / silhouette 8.1 / style 9.3，goal_visible 全 Y） |

## 4) 物料路径

| 物料 | 路径 | 规格 |
| --- | --- | --- |
| 封面 | `poster.jpg` | 1280×720 |
| 海报 | `poster-1920.jpg` | 1920×1080 |
| 列表动图 | `game.gif` | 480×270、5.0s 循环、1.1MB |
| SEO | `SEO.txt` | TITLE/CATEGORY/TAGS/SHORT/LONG DESCRIPTION 中英双份 |
| 图标 | `icon.png` | 256×256 |
| 站标 | `favicon.png` | 64×64 |

## 5) 未做项与已知问题

- 未接真实广告账号：`config/sdk.config.js` 的 `ads.enabled=false`，`source='local'`（vendored SDK）。上线前改 `source='online'` 并按站点策略开 `ads.enabled`。
- 未做多语言扩展（ja/ko/ar/ru）：只暴露 en/zh（按铁律，未完整翻译的语言整块不暴露）。
- 未做 AI 美术素材管线：全程序化 Canvas（符合「美术全程序化」要求，无外部素材）。
- 未做 G6.5 讲解视频（YouTube/X）——brief 未列入本次验收清单。
- 已知小问题：道具按钮计数在触屏小屏上偏小；`game.gif` 需在 ffmpeg 环境生成（脚本 `tools/record-gif.mjs` 产出 webm）。

## 6) 最不满意的一处

**视觉评审的「月下竹林」场景 contrast 偏低**：夜主题 + 绿色调容易把尖刺/风铃和背景糊在一起（第一次 vision-review 曾判 goal_visible=false，加常驻目标箭头 + 终点金色鸟居 + 提亮色板后才过）。理想做法是给竹林场景补一层冷色轮廓光描边，让前景与背景分离更彻底——目前只是「能过机器评审」，还没到「一眼惊艳」。
