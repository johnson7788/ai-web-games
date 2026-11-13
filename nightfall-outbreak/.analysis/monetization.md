# 变现设计 · NIGHTFALL: OUTBREAK

## 1. 点位表与转化触发点

| placement | 类型 | 出现界面 | 玩家痛点 | 奖励与文案 |
|---|---|---|---|---|
| `revive` | 激励视频 | 失败面板（血量归零，主按钮全宽独占） | 差一点清完这波、不想从头再打 | 原地满血复活 + 1.2s 无敌 + 清掉贴身僵尸；文案「CONTINUE THIS RUN / 继续这一局」，不是「看广告」 |
| `doubleCoins` | 激励视频 | 失败面板（**revive 不可用/已用时才出现**）与过关结算 | 攒金币换武器涂装，差一半 | 本局可消费金币 ×2；文案「DOUBLE SALVAGE」 |
| `assist` | 激励视频 | HUD 底部拇指区按钮，次数用尽时 | 被围住、血量危急 | 一次清场 + 回血；次数用光切成「WATCH AD +3」仍可点，返回 true 才补次数 |
| `stageClear` | 插屏 | 仅在过关动画之后（第 4 关起） | 无（被动曝光） | 无 |

少于 2 个激励位太薄、超过 3 个选择过载；本作恰好 3 个激励 + 1 个插屏。
`assist` 是 SDK 开放字典里的扩展位，站方父页面若不认该位，`canShow` 回 false，游戏走「暂无广告」toast，不白送奖励。

## 2. 助攻次数经济

- `perRun: 3`（新一局回满 3 次，跨关保留；每关回满等于白送）
- `refill: 3`（一次激励补 3 次，感知「赚到了」）
- `maxRefillPerRun: 2`（单局最多 6 次助攻，封顶防刷）
- 状态机：`left>0` 常显 `×n` → 用光切 `+3` 且可点 → `showRewarded("assist")===true` 才 `refill()` → 补充额度用尽才 `disabled` 并显示「本局已用完」。
- 助攻效果 = 立刻解围：清掉 6m 内僵尸 + 回 35 血 + 1.2s 无敌，值一次广告。

## 3. 频控与保护

- `interstitial.skipFirstLevels = 3`：前 3 关不弹插屏；**第 1 关教学关零广告**（连 revive 都不在此时出现，因为 failSafe 不会死）。
- 插屏只在 `levelCleared` 的过关动画之后调用，绝不在玩法中途弹；长关卡靠站方 45s 冷却收敛，游戏侧不再加关数门槛。
- 失败面板 **revive 独占**：`canDouble = !canRevive && canShow("doubleCoins")`，两个激励按钮永不同框。
- `canShowAd` 异步到位：面板打开后 900ms × 5 轮询补显，避免最高转化位因为「打开那 1 秒查不到」消失。
- 会话密度预算：每 10 分钟 ≤5 次曝光（插屏 + 完成的激励）。

## 4. 降级

- `Ads.init()` 返回 false（SDK 未加载 / 未授权 / 外网超时）→ 所有广告按钮隐藏，`canShow()` 恒 false，游戏仍可完整打完 10 关。
- `showRewarded` 非 `=== true`（未填充 / 中途关闭 / 频控）→ 只 toast，绝不发奖；次数不变。
- 广告期间 `onAdStart` → `audio.suspend()` + `game.pause()`；`onAdEnd` → 恢复音量与游戏，避免玩家回来已经死了。

## 5. 金币经济

- 金币来源：每只僵尸掉落（+2~+8，爆头加成）、过关奖励、连击结算。
- 金币出口：`config.shop.skins` 三件武器涂装（0 / 200 / 500），`ui.renderShop()` 在主菜单渲染，`game.buySkin()` 是唯一扣费点 `coins -= s.cost`，买下写进 `localStorage.owned`，刷新仍在。
- `doubleCoins` 翻倍的是这个可消费金币（`coins *= 2`），不是分数；HUD 与结算面板都显示金币数，玩家知道翻倍值多少。

## 6. 埋点

- `newRun()` 开局重置按局频控。
- `levelCleared` / `gameOver` payload 必带 `level / score / coins / durationMs / progress / revived`（`_funnelPayload()` 统一构造），`levelCleared` 另带 `stars`。
- 激励消耗补 `track("revive_used")`、`track("coins_doubled")`、`track("assist_refill")`。
- 关卡进度、最高分、金币、已购涂装、三星全部落盘 `pipy:nightfall-outbreak:v1`。

## 7. 收益预估与观测指标

**收益预估**（ads-design.md §6.2，按会话 3.5 次、插屏每会话 1~2 次、激励完成率 8%~15%、激励 eCPM 为插屏 4 倍估）：
- 插屏：1.5 次 × ¥12/千次 ≈ ¥0.018
- 激励：3.5 × 10% = 0.35 次 × ¥48/千次 ≈ ¥0.017
- 合计约 **¥0.03~0.04 / DAU**，落在 0.01~0.05 的健康区间；「差一点清完这波」的失败点让 revive 完成率可到 25%，是主要增量。

**观测指标**（上线后盯这四个）：
1. D1 次留 ≥25%（<20% 先砍插屏再查难度）
2. 每会话激励完成数 0.5~1.5（<0.3 = 转化点没放对）
3. 插屏曝光/会话 1~2（>3 说明长会话被过度收割）
4. revive 完成率 ≥15%（<8% = 文案/时机不对，或失败时进度太低）
