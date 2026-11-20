# 截图自动评审 — cell-wars

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.1 / silhouette 7.6 / style 9.3

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 8 | 6 | 9 | Y | N | N | Y | 背景网格模糊导致‘红菌株’区域辨识度低，影响目标感知；‘Best dish 0’文字颜色偏黄，在深蓝背景下对比度不足；右上角语言选择下拉框无展开指示图标，交互意图不明确 |
| tests/final/02-play.png | 8 | 9 | 9 | Y | N | N | Y | 提示文字 'Tap an enemy or neutral cell next to your blue cells' 被顶部半透明横条轻微遮挡，影响可读性；左上角计数器 '6 ● 7' 中红蓝圆点与数字间距过小，易误读为 '6●7'；右上角 'Charging 2/3' 图标与文字紧凑，图标细节在小屏可能模糊 |
| tests/final/03-mid.png | 8 | 9 | 10 | Y | N | N | Y | 顶部提示文字'Tap an enemy or neutral cell next to your blue cells.'部分被虚线框遮挡，影响可读性；左上角计数器'17 ● 28'中红点与数字间距过小，易误读为'17●28'而非区分阵营；右上角'Phage ready'按钮图标与文字紧凑，移动端可能误触 |
| tests/final/04-cleared.png | 9 | 6 | 8 | Y | N | N | Y | 背景网格模糊且无明确角色/敌人轮廓，眯眼时难以区分可交互元素与背景；‘Next dish 2’文字颜色偏黄，在深蓝背景下对比度略低，部分用户可能需稍聚焦才看清；‘Dish 1 cleared’与‘Continue’按钮垂直居中但间距紧凑，小屏设备可能误触 |
| tests/final/05-title-zh.png | 8 | 6 | 9 | Y | N | N | Y | 背景网格模糊，红/蓝菌株区域边界不清晰，影响快速识别敌我；‘最高第0皿’文字颜色偏黄，在深色背景下对比度偏低，易被忽略；右上角语言切换下拉框无展开箭头或悬停提示，交互意图不明确 |
| tests/final/06-mobile.png | 8 | 9 | 10 | Y | N | N | Y | 提示文字'Tap an enemy or neutral cell next to your blue cells.'部分被顶部'Your turn'按钮轻微遮挡（视觉上可读但位置偏高）；左上角计数器'DISH 1/12'与'ROUNDS 4/24'间距过小，易误读为单行；红色细胞的'C'符号在部分分辨率下可能被误认为旋转图标而非状态标识 |
| tests/final/tutorial-after-skip.png | 8 | 9 | 10 | Y | N | N | Y | 顶部提示文字 'Tap an enemy or neutral cell next to your blue cells' 被半透明圆角框轻微遮挡，影响可读性；左下角蓝色细胞区域有虚线框包围，但未说明其含义（是否选中？范围？），易引发歧义；右上角 'Charging 0/3' 图标与文字间距过小，图标可能被误认为装饰而非功能指示 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 底部提示框‘FIRST CULTURE’与网格底部两行细胞重叠，可能遮挡操作目标；右上角红色细胞图标中的C符号较细，眯眼时易与背景混淆，影响silhouette得分；左上角‘DISH 1/12’和‘ROUNDS 0/24’间距过小，轻微视觉拥挤 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

