# 截图自动评审 — penta-cards

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.1 / silhouette 6.5 / style 8.4

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 7 | 8 | Y | N | N | Y | 标题‘PENTA CARDS’发光效果略过强，导致部分字母边缘轻微晕染，影响远距离辨识；‘English’语言切换按钮无下拉箭头视觉提示，可能被误认为静态标签；副标题字体较小且灰度偏高，在低对比度环境下易被忽略 |
| tests/final/02-title-zh.png | 9 | 5 | 8 | Y | N | N | Y | ‘PENTA CARDS’发光文字在深色背景上存在轻微光晕溢出，可能影响高对比度场景下的辨识；‘连成星阵，卡五星定胜负’副标题字号偏小，弱光环境下易被忽略；右上角语言切换按钮无悬停反馈提示，交互意图不明确 |
| tests/final/03-play.png | 8 | 7 | 9 | Y | N | N | Y | 左下角‘2 4’小图标无标签，功能不明（疑似手牌计数但未说明）；WALL 39堆叠卡牌图标与下方数字4/9/5间距过近，易误触；右上‘Observatory’按钮与‘WALL 39’文字紧邻，视觉层级混乱 |
| tests/final/04-result.png | 9 | 7 | 8 | Y | N | N | Y | ‘Constellation formed!’标题无明确层级区分，与下方条目对比度偏低，可能影响快速扫读；‘Round 1/12’中斜杠与数字间距过小，易误读为‘112’或‘1/1’；背景模糊元素（底部疑似棋盘/卡牌）轮廓不清，可能干扰主弹窗焦点 |
| tests/final/05-play2.png | 8 | 7 | 9 | Y | N | N | Y | WALL堆叠牌（43）与下方三张操作牌（太阳/2/8）间距过小，易误触；左上角‘ROUND 2/12’与‘BET 1’标签字体偏小，弱光下辨识度略低；右上‘Observatory’按钮与‘WALL 43’数值重叠视觉层级，虽未物理遮挡但信息密度高 |
| tests/final/06-mobile.png | 7 | 6 | 8 | Y | N | N | Y | 中央三张可选牌（3/8/9）与下方手牌视觉层级接近，易混淆操作对象；左上角'BET 1'与星形筹码图标间距过小，可能误判为一个整体；右上角'Observatory'标签与'WALL 41'重叠轻微，边缘文字略挤 |
| tests/final/tutorial-after-skip.png | 7 | 6 | 8 | Y | N | N | Y | WALL堆叠图标（44）位于屏幕中央，但无明确指示其为可交互目标，易被误认为装饰；底部手牌中部分数字（如2、8）与星标/水滴图标间距过小，视觉干扰；右上角'Observatory'标签与'WALL 44'按钮紧邻，布局拥挤，可能影响快速定位 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 中央'WALL 44'卡堆与背景星空对比度偏低，远距离辨识稍弱；右上角'Observatory'按钮与'Skip'按钮部分重叠且层级混乱；'FIRST HAND Step 1/3'提示框遮挡下方部分手牌（如数字5、6区域） |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

