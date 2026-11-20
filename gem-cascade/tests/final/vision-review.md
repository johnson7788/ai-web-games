# 截图自动评审 — gem-cascade

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.9 / silhouette 7.1 / style 9.3

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 7 | 10 | Y | N | N | Y | ‘Best level 1’文字颜色为黄色，与主紫白配色略突兀，可能影响视觉层级；标题‘GEM CASCADE’发光效果过强，部分字母边缘轻微晕染，可能在低分辨率屏上模糊；右上角语言切换按钮无图标仅文字，小屏设备可能误触或识别困难 |
| tests/final/02-title-zh.png | 9 | 7 | 8 | Y | N | N | Y | 标题‘宝石矿脉’发光效果过强，导致部分笔画边缘模糊，影响远距离辨识；‘最高关卡 1’文字颜色偏黄，在深紫背景下对比度偏低，易被忽略；右上角语言切换下拉框无展开箭头图标，交互意图不明确 |
| tests/final/03-play.png | 9 | 8 | 10 | Y | N | N | Y | 底部提示框‘FIRST BLAST’与下方按钮轻微重叠（视觉上遮挡按钮上边缘）；左上角‘LEVEL 1’与‘Fluorspar Cave’标签间距过小，易误读为单个元素；右上角‘MOVES ∞’符号∞在部分缩放下可能被误认为数字8 |
| tests/final/04-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 顶部‘Fluorspar Cave’标签背景与文字对比度偏低，弱光下可能难辨；网格中部分宝石因反光过强导致颜色边界模糊，影响快速识别；‘STREAK 1’和‘MOVES ∞’按钮间距过近，小屏可能误触 |
| tests/final/05-paused.png | 9 | 4 | 8 | Y | N | N | Y | 背景模糊方块阵列无法辨识为游戏元素（如方块/敌人），影响 silhouette 判断；‘Paused’标题与按钮间距偏小，视觉层级略弱于按钮；右上角语言切换下拉框无展开指示图标，移动端可能误触 |
| tests/final/06-tutorial.png | 9 | 8 | 10 | Y | N | N | Y | 底部提示框‘FIRST BLAST’与下方‘Pickaxe’/‘Wash’按钮间距过小，可能误触；右上角‘MOVES ∞’符号∞在部分字体下可能显示异常（需验证）；‘Step 1/3’字号偏小，弱光环境下辨识度略低 |
| tests/final/tutorial-after-skip.png | 9 | 8 | 10 | Y | N | N | Y | 顶部‘Fluorspar Cave’标签与‘Blast clusters of 2+ gems’提示间距过小，可能影响快速扫读；‘MOVES ∞’图标中∞符号略小且无文字说明，新手可能不解其意；底部‘Pickaxe’和‘Wash’按钮无悬停/选中反馈视觉提示 |
| tests/final/tutorial-first.png | 9 | 8 | 9 | Y | N | N | Y | 底部提示框‘FIRST BLAST’与下方按钮有轻微视觉干扰，建议增加间距或降低透明度；右上角‘MOVES ∞’符号∞在深紫背景下对比度偏低，易误读为‘00’；‘Step 1/3’字体过小（约10px），在低分辨率屏可能难辨 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

