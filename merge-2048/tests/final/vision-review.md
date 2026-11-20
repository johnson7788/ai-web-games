# 截图自动评审 — merge-2048

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.1 / silhouette 6.0 / style 8.4

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 标题 'MERGE 2048' 发光效果过强，导致部分笔画边缘模糊，影响远距离辨识；‘Best score 0’ 字体颜色偏黄，在深蓝背景上对比度偏低，易被忽略；右上角语言选择下拉框无展开箭头图标，交互意图不明确 |
| tests/final/02-play.png | 7 | 6 | 8 | Y | N | N | Y | ‘Sector 1’与‘Goal 32t’文字过小且无对比度，眯眼时易混淆为背景星点；三个‘2 ship’方块视觉权重相同，无主次区分，玩家难以判断优先操作对象；左上角HUD按钮（SCORE/BEST SHIP/MOVES）边框与背景融合度高，低对比下易忽略 |
| tests/final/03-gravity.png | 8 | 7 | 9 | Y | N | N | Y | Sector 2 / Goal 64t 文字较小且无高亮，易被忽略；16 ship 和 2 ship 的 'ship' 标签字号过小，与数字对比度不足；WARP x1 按钮边框与背景对比度偏低，夜间模式下辨识度下降 |
| tests/final/04-win.png | 9 | 7 | 10 | Y | N | N | Y | ‘NEW RECORD’标签发光过强，可能造成视觉干扰；‘Press R to relaunch’提示字号偏小，弱光环境下辨识度略低；‘Sector reached’数值‘2’与标签间距略紧，轻微影响可读性 |
| tests/final/05-dead.png | 9 | 5 | 8 | Y | N | N | Y | ‘Fleet Locked’标题与下方信息间距偏小，略显拥挤；‘Press R to relaunch’提示字号过小，易被忽略；背景深蓝渐变与弹窗发光边框存在轻微光晕干扰，影响视觉聚焦 |
| tests/final/06-mobile.png | 7 | 6 | 8 | Y | N | N | Y | 目标 'Goal 32t' 字体偏小且无强调，易被忽略；底部两个 '2 ship' 单元格视觉上像独立按钮，但未明确指示可拖拽/移动操作；左上 HUD 数值（SCORE/BEST SHIP/MOVES）与背景对比度偏低，弱光下可能难辨 |
| tests/final/07-title-zh.png | 9 | 5 | 8 | Y | N | N | Y | 标题‘MERGE 2048’发光效果过强，可能在低对比度屏幕下产生光晕干扰阅读；‘最高分 0’文字颜色偏黄，在深蓝背景下对比度偏低，易被忽略；右上角语言切换按钮无图标仅文字，且下拉箭头小，移动端辨识度不足（虽为桌面截图，但需考虑响应式） |
| tests/final/tutorial-after-skip.png | 7 | 6 | 8 | Y | N | N | Y | 网格单元无明显选中/高亮状态，玩家难以判断当前可操作对象；‘Sector 1’与‘Goal 32t’字号过小且颜色偏淡，远距离辨识度低；两个‘2 ship’按钮视觉上完全相同，缺乏区分性（如方向/编号），易误操作 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

