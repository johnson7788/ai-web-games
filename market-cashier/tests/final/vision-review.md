# 截图自动评审 — market-cashier

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.8 / silhouette 6.9 / style 8.4

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop-title.png | 9 | 6 | 8 | Y | N | N | Y | 背景人物剪影模糊，眯眼时难以辨识为角色（silhouette偏低）；右下角纸张元素轻微遮挡主面板右下角，虽未影响按钮但存在视觉干扰；‘PIPY GAMES · SHIFT 01’字号过小且颜色偏淡，部分用户可能忽略 |
| tests/final/desktop-scan.png | 8 | 7 | 9 | Y | N | N | Y | 收银台角色头像被顶部‘0 SCORE’遮挡部分轮廓；右侧‘CASH DRAWER’中‘$7.20’与‘$0.00’颜色对比弱，易误读；‘TODAY'S QUEUE’进度条下方文字‘0/5’字号偏小，远距辨识度低 |
| tests/final/desktop-change.png | 8 | 7 | 9 | Y | N | N | Y | 收据区域‘All scanned — build the change’提示文字与下方‘TODAY’S QUEUE’进度条间距过小，易误触；现金抽屉中‘$0.01’按钮背景色（浅灰）与其他硬币按钮（灰白）对比度不足，辨识度偏低；左下角‘BASKET TOTAL $12.80’与扫描区底部操作提示重叠，视觉层级混乱 |
| tests/final/desktop-day.png | 9 | 6 | 8 | Y | N | N | Y | ‘Shift bonus +200 • CHOOSE ONE UPGRADE’文字较小且居中偏下，易被忽略；建议加粗或上移；‘Day 1 / 3’标题与下方统计块间距过小，视觉层级略弱；‘Coin Sense’描述末尾‘are close.’疑似截断（应为‘you are close’），语义不完整 |
| tests/final/desktop-ending.png | 9 | 7 | 8 | Y | N | N | Y | ‘S’徽章与‘FINAL SCORE’文字间距偏小，略显拥挤；背景模糊界面元素隐约可见，可能干扰焦点（如顶部4077与角色头像）；‘Perfect shift...’提示语字号偏小，弱光环境下可读性下降 |
| tests/final/mobile-scan.png | 9 | 7 | 8 | Y | N | N | Y | ‘SCAN THE BASKET’列表中，Eggs、Tomato、Chicken左侧状态条颜色（黄/红/粉）含义未标注，易混淆；收银台区域‘PATIENCE 30s’进度条与暂停按钮间距过小，可能误触；现金抽屉中‘$0.25’按钮为棕黄色，与其他绿色/灰色币值按钮风格不一致 |
| tests/final/tutorial-first.png | 9 | 7 | 8 | Y | N | N | Y | 教程提示框遮挡部分商品列表顶部，可能影响首次操作视线；收银台区域‘TODAY'S QUEUE’进度条文字过小（约10px），远低于可读阈值；现金抽屉中‘$10.00 - $5.00 = $5.00’计算式字体颜色偏淡（#666），对比度不足 |
| tests/final/tutorial-after-skip.png | 9 | 8 | 9 | Y | N | N | Y | 现金抽屉中‘$0.00’绿色文字与背景对比度偏低，弱光下可能难辨；收据区域‘Scan Items – the receipt prints here’提示文字偏小且灰度高，易被忽略；顶部‘PATIENCE’进度条右侧图标（扳手+暂停）间距过近，可能误触 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

