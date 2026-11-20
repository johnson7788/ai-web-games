# 截图自动评审 — dig-deep

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.1 / silhouette 6.5 / style 8.6

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 5 | 8 | Y | N | N | Y | 标题‘DIG DEEP’发光效果过强，导致部分字母边缘轻微晕染，影响远距离辨识；‘Best: 0’文字字号偏小且对比度低，易被忽略；右上角语言选择下拉框无展开箭头图标，交互意图不明确 |
| tests/final/02-play.png | 8 | 7 | 9 | Y | N | N | Y | ‘Flood △’提示文字颜色过浅（青色），在深棕背景上对比度不足，易被忽略；左下角蓝色菱形标记（玩家位置？）与数字2重叠，视觉层级混乱，未明确指示玩家身份；右上角工具按钮（Shovel/Drill/Laser）无图标仅文字，小屏设备辨识度低 |
| tests/final/03-fossil.png | 8 | 7 | 9 | Y | N | N | Y | ‘Flood —’文字颜色过浅（青蓝），在深背景上对比度偏低，易被忽略；部分格子内数字与斜线符号（如‘-1’）排版拥挤，可能误读为‘1’或‘/’；右上角工具按钮（Shovel/Drill/Laser）无图标仅文字，移动端辨识成本高 |
| tests/final/04-core.png | 8 | 7 | 9 | Y | N | N | Y | 顶部‘Flood —’文字颜色过浅（青蓝），在深棕背景上对比度不足，易被忽略；左上角‘DEPTH 85’与‘LAYER 11 · Rising Magma’标签间距过小，视觉拥挤；部分数字‘2’在浅橙格中（如第1行第1格）与背景对比度偏低，辨识稍弱 |
| tests/final/05-dead.png | 8 | 5 | 7 | Y | N | N | Y | 背景网格模糊导致可交互格子边界不清，影响‘挖’操作目标定位；‘The flood caught you’红色提示文字字号偏小，与主标题对比度不足，易被忽略；‘Title’按钮样式（深灰圆角）与‘Dig again’（金边浅棕）风格不一致，疑似未完成UI |
| tests/final/06-mobile.png | 8 | 7 | 9 | Y | N | N | Y | ‘Flood ▲’提示文字颜色偏淡（青色），在深棕背景上对比度不足，易被忽略；右下角浅米色方块内数字‘2’疑似被部分裁切（右下角缺角）；深度条右侧数值‘34’与进度条重叠，轻微视觉干扰 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 顶部'Flood △'文字与进度条间距过小，易误读为进度条标签；右上角按钮组（Shovel/Drill/Laser）无视觉层级区分，功能优先级不明确；部分深棕方块内'√'符号颜色过暗，与背景对比度不足（如第1行第4列、第5行第4列） |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 右下角‘HOW TO DIG’提示框部分遮挡底部可交互格子（第6行第2、4列蓝色2格）；顶部‘Flood ▲’文字与进度条间距过小，易误读为‘Flood▲’连写；左上角‘DEPTH 0’与‘LAYER 1 · Topsoil’标签背景色相近，层次感弱 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

