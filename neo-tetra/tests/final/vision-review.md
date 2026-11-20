# 截图自动评审 — neo-tetra

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.1 / silhouette 6.6 / style 8.6

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 标题 'NEO TETRA' 发光效果过强导致部分字母边缘模糊，影响远距离辨识；‘Best 0’ 字体偏小且与背景对比度不足，易被忽略；右上角语言选择下拉框无展开指示图标，移动端交互意图不明确 |
| tests/final/02-title-zh.png | 9 | 6 | 8 | Y | N | N | Y | 标题‘NEO TETRA’发光效果过强，导致部分字母边缘轻微晕染，影响远距离辨识；‘最佳 0’文字字号偏小且颜色较暗，与背景对比度不足，易被忽略；右上角语言切换按钮无悬停反馈，且下拉箭头与‘中文’间距过近，可能误触 |
| tests/final/03-play.png | 8 | 7 | 9 | Y | N | N | Y | ‘HOLD’标签颜色过小且与‘Copper Vein’文字紧贴，易误读为‘HOLD Copper Vein’；‘NEXT’预览块与右侧HEAT条间距过近，视觉拥挤；网格线较细，在低对比度下可能影响方块边界辨识 |
| tests/final/04-paused.png | 8 | 4 | 7 | Y | N | N | Y | 背景模糊导致玩家轮廓（底部青色光柱）难以辨识，silhouette得分低；‘Paused’标题与按钮间距偏大，视觉重心分散，影响3秒内目标理解；右上角语言切换下拉框无展开指示符，交互意图不明确 |
| tests/final/05-dead.png | 9 | 7 | 10 | Y | N | N | Y | ‘NEW RECORD’标签与标题间距过小，视觉层级略显拥挤；‘Press R to smelt again’提示字号偏小，低对比度下易忽略；背景模糊光晕可能干扰部分用户对中心面板的聚焦 |
| tests/final/06-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 中央提示框‘FIRST SMELT’字体偏小，弱光下可能辨识困难；NEXT 区域的4个青色方块无标签，功能不明确；左上角‘HOLD’文字颜色过淡，与背景对比度不足 |
| tests/final/07-restart.png | 7 | 8 | 9 | Y | N | N | Y | ‘HOLD’标签字体过小且无背景，易被忽略（左上角）；‘NEXT’预览区与主游戏区间距过近，视觉干扰（右侧）；热力条文字‘5 to next layer’颜色过浅，对比度不足（右上角） |
| tests/final/tutorial-after-skip.png | 7 | 8 | 9 | Y | N | N | Y | 左上角 'HOLD' 标签字体过小且颜色偏淡（#FFD700），在深棕背景下对比度不足；右上角 'HEAT' 进度条无数值标注，'5 to next layer' 字体偏小，易被忽略；底部灰色方块组与网格线颜色接近（灰+浅棕），低对比下可能误判为背景 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

