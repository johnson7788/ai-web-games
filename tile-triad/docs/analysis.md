# 源码分析 — 羊了个羊 cocos3.0

源码：`local/src1/羊了个羊cocos3.0/CatCat/assets/Scripts/`（Cocos Creator 3.x，TypeScript 组件）。

## 玩法事实（带文件:行号）

- **层叠牌局 + 每堆叠放**：`GameManager.ts:99` `placeIndex = Math.floor(count / 2)` 每定位节点放 2 张；`GameManager.ts:109` `setPosition(new Vec3().add3f(0, -15 * tempArray.length, 0))` 同堆向上偏移叠放。
- **灰 = 不可点**：`GameManager.ts:119-122` 放置新牌时把下层 `element.setGray(true)`；`Card.ts:20-28` `setGray` 同时置 `grayscale = flag` 与 `interactable = !flag`。
- **点击移入收槽**：`GameManager.ts:138-176` `moveCard()`，`selectedCount++`，`tween 0.5s` 平移到 `harvestNodes[selectedCount]`；移走后 `GameManager.ts:165-174` 把下一层 `setGray(false)` 翻出。
- **三同消除**：`GameManager.ts:178-209` `moveOver()`，`GameManager.ts:189` `if (count % 3 == 0) removeCard(...)`；`GameManager.ts:211-246` `removeCard()` 隐藏同名牌并重新整理收槽。
- **槽满判负 / 胜利**：`GameManager.ts:199` `selectedCount >= 6` 判负（本作按 spec 采用 7 格收槽）；`GameManager.ts:205` `score >= cardNum` 胜利。
- **品类 = 6 图 × 每图 3 的倍数**：`GameManager.ts:57` `cardName = "items_" + (Math.floor(i / 6) + 1)`；`GameManager.ts:13-14` `cardNum`（3 的倍数）。
- **进入场景**：`StartGame.ts:6-9` `director.loadScene("scene_1")`。

## 结论

原作是「三消式层叠牌」的极简 Cocos 版：核心循环 = 点顶牌 → 入槽 → 三同消除 → 翻下层；失败 = 槽满；胜利 = 清空。无道具、无关卡推进、无求解器。本作按 spec 补齐了 7 格收槽、撤回/洗牌、12 关三轴递进、三场景换章、可解性生成器+回溯求解器，并整体重写为原创「药草集市」主题。
