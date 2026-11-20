# 截图自动评审 — snakes-ladders-classic

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 6.8 / style 8.6

**结论：FAIL**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 8 | 7 | 9 | Y | N | N | Y | ‘Neon race to cell 47’文字与棋盘部分重叠，略显干扰；右上角问号框内无内容，可能为占位符未填充；玩家（红B）与起点树形图标位置紧邻，视觉区分稍弱 |
| tests/final/02-playing.png | 8 | 7 | 9 | Y | N | N | Y | 黄色玩家棋子（标'YOU'）与绿色路径线重叠，视觉优先级略低；；右侧‘Rolling...’按钮文字无背景，暗色背景下对比度偏低；；骰子显示4点但未标注数值，依赖图形识别，对色盲用户不友好 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 玩家A（蓝圈）与绿色树形图标紧邻，视觉上易混淆身份；骰子区域下方‘Dice’标签字体过小且颜色偏暗，辨识度低；右上角‘Your turn’提示框无边框/背景，与深色背景对比不足 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | Y | N | Y | 教程弹窗遮挡了部分棋盘格与路径线（如13-14格区域），影响路径判断；右下角'ROLL'按钮被弹窗部分覆盖，且未高亮显示当前可操作状态；‘? ’图标在深色背景上对比度偏低，易被忽略 |
| tests/final/tutorial-replay.png | 8 | 6 | 7 | Y | Y | N | Y | 中央弹窗遮挡棋盘关键区域（如蛇梯路径与玩家位置）；玩家标记（蓝色圆圈A）与 rival 标记（红/蓝圆点）对比度低，眯眼难区分；‘Neon race to cell 47’文字颜色偏淡，与背景对比不足 |

## Critical（必须修）

- tests/final/tutorial-first.png: HUD 遮挡
- tests/final/tutorial-replay.png: HUD 遮挡

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

