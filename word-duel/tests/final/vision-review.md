# 截图自动评审 — word-duel

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.6 / silhouette 8.6 / style 9.6

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 8 | 9 | Y | N | N | Y | 底部 'SPELLTACK' 字母块中 'T', 'A', 'C', 'K' 背景为深蓝，与前5个浅棕不一致，视觉割裂；关卡编号1-12按钮中，1号高亮但无明确选中状态说明（如边框/阴影），易误判；‘0/36’星星计数文字偏小，且与‘Start’按钮间距过近，略显拥挤 |
| tests/final/02-playing.png | 7 | 9 | 10 | Y | N | N | Y | 字母栏中'I'与'O'间距过小易误触，建议增加间隔；‘Swap 3’按钮文字为黄色但背景深绿，对比度偏低（约3.2:1），弱光下可能难辨；中央环形动画无明确功能提示，新手可能困惑其是否可交互 |
| tests/final/03-spelling.png | 8 | 9 | 10 | Y | N | N | Y | ‘IOE’下方字母格中，前3格高亮为黄底黑字，后5格为黑底白字，视觉权重不均，易误判有效拼写范围；‘Swap 3’按钮文字为黄色，与‘Cast’按钮颜色冲突，可能误导优先级；顶部‘Turn 1’按钮无边框/背景，与深色背景对比度偏低，小屏下辨识度风险 |
| tests/final/04-wordcloud.png | 7 | 8 | 9 | Y | N | N | Y | 敌人头顶 'ENEMY' 文字与光环重叠略显拥挤，部分字母（如 E、K）被光晕半遮；左上角 'Level 1 · Novice Duelist' 和 'Turn 2' 按钮间距过小，易误触；底部字母格子无选中反馈，玩家难以判断当前已选字母 |
| tests/final/05-scene2.png | 7 | 9 | 10 | Y | N | N | Y | 顶部 'Turn 1' 与 'Level 5 - Time Warden' 间距过小，易误读为单行文本；底部字母格无视觉分隔线，G/D/G/N/G/E/A/E/I 中连续 G/E 易混淆；‘Swap 3’按钮文字颜色（黄）与背景对比度偏低，弱光下可能难辨 |
| tests/final/06-scene3.png | 7 | 9 | 10 | Y | N | N | Y | 顶部'Level 9 · Letter Thief'与'Turn 1'按钮间距过小，可能误触；中间'...'加载指示器位置居中但无明确语义，易被忽略；玩家角色头顶'YOU'文字略小且无背景衬底，在深色背景下对比度偏低 |
| tests/final/07-result.png | 9 | 8 | 9 | Y | N | N | Y | ‘PLATOON’文字位于按钮上方且半透明，与下方字母格轻微重叠，可能干扰拼字操作；左上角‘Level 1 · Novice Duelist’和‘Turn 2’字号过小，弱光环境下辨识度低；敌人头像后隐约可见‘ENEMY’及字母环，视觉层级混乱，易误读为可交互元素 |
| tests/final/08-mobile.png | 7 | 9 | 10 | Y | N | N | Y | 字母行'DETGLEIOD'中'E'重复且无空格分隔，易误读为'DETG L E I O D'或'DETGLE IOD'；左下'Swap 3'按钮文字为黄色但背景深紫，对比度偏低（尤其在暗屏下）；顶部'Turn 1'与'Level 1 · Novice Duelist'间距过小，视觉上易混淆为单个标签 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

