# 截图自动评审 — meow-miao

> 7 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.4 / silhouette 7.0 / style 8.9

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 7 | 8 | Y | N | N | Y | 右侧堆叠方块中部分图形（如菱形、三角形）轮廓光晕过强，导致形状辨识度略低；‘Match 3 of a kind’提示文字颜色偏淡，与深背景对比度不足，易被忽略；左下角关卡按钮（1-10）无选中态反馈，当前无法判断是否可交互或已解锁 |
| tests/final/02-playing.png | 9 | 8 | 10 | Y | N | N | Y | 底部‘Match 3 of a kind’提示文字与下方空槽间距过小，可能误触；右上角‘How to play’按钮无悬停反馈，且图标语义模糊（问号缺失）；部分方块（如青色圆圈）在深蓝背景上对比度偏低，弱光下易混淆 |
| tests/final/03-combo.png | 8 | 7 | 9 | Y | N | N | Y | 底部‘Match 3 of a kind’提示文字与下方空槽轻微重叠，可能影响视觉焦点；右上角‘x2 Combo’按钮与‘How to play’按钮间距过小，易误触（桌面截图但需考虑响应式）；部分灰色岩石状障碍物轮廓与背景网格线融合度高，眯眼时辨识度略低 |
| tests/final/04-result.png | 9 | 7 | 8 | Y | N | N | Y | ‘60s left’与‘Score 1000 · x4 Combo’字号过小，对比度偏低，易被忽略；底部‘Match 3 of a kind’提示文字模糊且部分被遮挡（疑似未完全渲染）；三颗星图标与‘Perfect Combo!’文字间距过近，视觉拥挤 |
| tests/final/05-rocks.png | 8 | 7 | 9 | Y | N | N | Y | 底部‘Match 3 of a kind’提示文字与下方空槽间距过小，易误触；部分灰色障碍物轮廓与背景对比度低，眯眼时易混淆为背景网格；右上角‘How to play’按钮无悬停反馈，且图标语义模糊（问号缺失） |
| tests/final/06-wilds.png | 8 | 7 | 9 | Y | N | N | Y | 底部‘Match 3 of a kind’提示文字与下方空槽间距过小，易误触；右上角‘How to play’按钮无悬停反馈，且图标语义模糊（问号缺失）；部分方块（如星形）内图标尺寸偏小，眯眼时难以区分形状 |
| tests/final/07-lose.png | 8 | 6 | 9 | Y | N | N | Y | ‘Shelf Overflow’标题与背景方块部分重叠，视觉干扰；；中央堆叠方块在模糊光晕下轮廓不清，影响‘silhouette’评分；；底部‘Match 3 of a kind’提示文字过小且灰度高，易被忽略 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

