# 截图自动评审 — card-lord

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.9 / silhouette 6.5 / style 8.6

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-bidding.png | 8 | 7 | 9 | Y | N | N | Y | 顶部‘You · 17’等玩家信息与中间‘Bidding — Your turn’提示存在轻微视觉层级冲突，可能分散注意力；手牌上方小数字（如3/4）字号过小，眯眼时易与花色混淆；左右两侧卡背堆叠区域无明确归属标识，新手可能误判为对手手牌 |
| tests/final/02-doubling.png | 8 | 7 | 9 | Y | N | N | Y | 中间‘Double? — Your turn’提示框与下方手牌区域间距过小，易误触；左上角‘TIER 1 · Novice’和‘MULTIPLIER ×1’文字较小且对比度偏低，弱光下难辨；右上角‘Mute’按钮无悬停反馈或视觉状态指示 |
| tests/final/03-playing.png | 8 | 7 | 9 | Y | N | N | Y | 中央'Your turn'提示框与上方AI手牌轻微视觉干扰，可能误读为可交互元素；左上角'TIER 1 · Novice'与'MULTIPLIER ×1'间距过小，小屏易混淆；右下角高亮牌组边缘光晕过强，部分遮挡牌面数字（如最右3♣） |
| tests/final/04-selected.png | 8 | 7 | 9 | Y | N | N | Y | 中央‘Your turn’提示与手牌区域距离过近，可能误触；顶部AI分数标签（You·14, AI-L·17等）字体偏小且无背景衬底，暗背景下辨识度略低；左上角‘TIER 1 · Novice’与‘MULTIPLIER ×1’间距紧凑，新手易忽略层级关系 |
| tests/final/05-after-play.png | 8 | 7 | 9 | Y | N | N | Y | 顶部AI分数栏‘You · 12’与‘AI-L · 15’间距过小，易误读为‘You·12AI-L·15’；左上角‘TIER 1 · Novice’与‘MULTIPLIER ×1’按钮堆叠紧凑，缺乏视觉分隔；底部‘Play’按钮紫色渐变与整体霓虹风格略冲突，饱和度偏高 |
| tests/final/06-late.png | 7 | 6 | 8 | Y | N | N | Y | 中央'Your turn'提示与下方手牌间距过小，易误触；左上'TIER 1 · Novice'与'MULTIPLIER ×1'标签字体大小不一致，层级混乱；AI-L/AI-R分数框背景色与卡片边框色接近，辨识度低 |
| tests/final/07-zh.png | 7 | 6 | 8 | Y | N | N | Y | 中央‘轮到你了’提示框与下方手牌区域间距过小，易误触；左上角‘段位 1 · 新手’与‘倍数 ×1’标签字体偏小且对比度不足，3秒内不易识别；AI玩家牌堆仅显示顶部2张牌（9♣/9♦），其余为纯色轮廓，无法判断牌数是否准确 |
| tests/final/08-result.png | 9 | 5 | 8 | Y | N | N | Y | 段位、倍数、得分行右侧数值（如‘1→2’‘x1’‘+1’）与左侧标签间距不一致，视觉对齐松散；‘升段！2’按钮文字偏小且无明确层级区分，易被忽略；整体为深紫背景+浅紫UI，对比度偏低，眯眼时信息块边界模糊，影响silhouette评分 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

