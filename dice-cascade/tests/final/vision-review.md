# 截图自动评审 — dice-cascade

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.9 / silhouette 6.9 / style 9.0

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-play-stone.png | 8 | 7 | 9 | Y | N | N | Y | 顶部 'Stone Temple 1/12' 文字与边框间距过小，略显拥挤；底部 'cost 0' 字号偏小，对比度不足，易被忽略；右侧 'RUNE 0 / 0/5' 进度条无填充，视觉反馈弱 |
| tests/final/02-play-jade.png | 8 | 7 | 9 | Y | N | N | Y | 左上角'UNBANKED 25'与垂直线重叠，可能干扰视觉焦点；底部'1 cost 4'和'2 cost 4'按钮文字较小，远距离辨识度略低；'RUNE 0'进度条无明确起止标识，易误读为0/1而非0/5 |
| tests/final/03-play-lava.png | 8 | 7 | 9 | Y | N | N | Y | 顶部 'Lava Temple 9/12' 文本与橙色边框轻微融合，对比度偏低；底部倍率按钮（×4, ×2 等）图标与文字间距过小，易误触；左侧斜线装饰元素无功能说明，可能干扰新手理解 |
| tests/final/04-triple.png | 8 | 7 | 9 | Y | N | N | Y | 顶部'Unbanked 132'与'Score 0'间距过小，易误读为一个字段；底部倍率按钮（x4/x2/x1）无明确选中态，当前高亮'Rune'按钮但未说明其状态含义；网格中两个发光点（左下和中上）视觉突出但无交互提示，可能误导为可点击目标 |
| tests/final/05-play-zh.png | 7 | 6 | 9 | Y | N | N | Y | 顶部‘石殿 1/12’与左上角‘得分 0’间距过近，易误读为同一组信息；网格中圆点大小统一、无状态区分（如已选/未选），眯眼时难以分辨可交互元素；右上角‘符文 0 / 0/5’进度条文字与背景对比度偏低，小字号易忽略 |
| tests/final/06-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 顶部 'Stone Temple 1/12' 文字与主面板边框轻微重叠，视觉上略显拥挤；右上角 'RUNE 0 / 0/5' 中斜杠前后间距不一致，排版不够严谨；底部 '1 cost 0' 标签字体过小，远距离辨识度偏低 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 顶部 'Stone Temple 1/12' 文字略小，远距离可能辨识困难；底部 'cost 0' 与 'Roll' 按钮间距过近，易误触；右侧 'RUNE 0 / 5' 进度条无明确刻度，数值含义需推测 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 顶部 'Stone Temple 1/12' 文字略小，远距离可能难辨；右上角 'Skip' 按钮悬停提示遮挡部分 'RUNE 0' 和 'ROLL' 按钮；底部 'Roll' 按钮与左右按钮间距过窄，触控易误触 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

