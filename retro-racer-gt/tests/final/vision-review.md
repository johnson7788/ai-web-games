# 截图自动评审 — retro-racer-gt

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.6 / silhouette 8.0 / style 9.2

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-race.png | 8 | 9 | 10 | Y | N | N | Y | 顶部 'SCORE 573 KM/H 85 BEST 0' 数值间距过密，易误读为单个数字；黄色星形目标偏右下，与玩家车距离较远，新手可能忽略；底部中央 'NITRO' 按钮无图标仅文字，功能意图稍弱于左右方向键 |
| tests/final/02-race-nitro.png | 8 | 9 | 10 | Y | N | N | Y | 右上角 'COMBO x2' 和 'TIER 1' 按钮间距过小，可能误触；左上角 'BEST 0' 数值与 'KM/H 94' 对齐不一致，视觉层级混乱；右侧黄色星星目标偏右，靠近边界，易被忽略 |
| tests/final/03-race-rocks.png | 9 | 7 | 8 | Y | N | N | Y | ‘Wrecked · New best!’标题中‘·’与文字间距过小，略显拥挤；背景网格线与HUD边框同为霓虹紫/青色，部分区域视觉干扰稍强；‘Stars’值为0但未用灰色弱化显示，易被误读为可收集项 |
| tests/final/04-race-traffic.png | 9 | 8 | 10 | Y | N | N | Y | ‘Best’数值1135用黄色高亮，但‘Score’同值未高亮，视觉优先级不一致；背景中车辆轮廓与HUD边框颜色接近（青蓝/紫），弱化玩家车辨识度；‘Max combo x3’与‘Coins earned +66’行距略紧，小屏可能误读 |
| tests/final/05-race-mobile.png | 9 | 7 | 8 | Y | N | N | Y | ‘Best’数值750用黄色高亮，但‘Score’同值未高亮，视觉优先级不一致；背景网格线与HUD边框颜色接近（紫/粉），轻微干扰阅读；‘Max combo x2’中‘x2’为斜体小字号，与列表其他项格式不统一 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

