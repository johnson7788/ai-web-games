# 截图自动评审 — plumber-run

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.9 / silhouette 6.8 / style 9.0

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 3 | 8 | Y | N | N | Y | 背景模糊人影轮廓与标题文字亮度接近，眯眼时难以区分玩家/环境元素（silhouette低）；‘Best level 1’文字颜色偏淡、字号小，易被忽略；右上角语言切换按钮无明确交互反馈样式（如悬停态），可能影响可用性 |
| tests/final/02-play.png | 8 | 9 | 10 | Y | N | N | Y | 左上角 HUD 按钮（LEVEL/COINS/LIVES）间距过小，可能误触；右上角 SCORE 和 STEAM 标签文字偏小，远距离辨识度略低；红旗旗杆与背景屋顶轮廓接近，部分玩家可能误判为障碍物 |
| tests/final/03-play2.png | 8 | 7 | 9 | Y | N | N | Y | 玩家角色与背景山形色差小，眯眼时辨识度略低；左上角HUD按钮文字（如'LEVEL 2'）字号偏小，远距离阅读稍费力；右上角'STEAM'和'Small'标签无明确功能说明，易混淆 |
| tests/final/04-sewer.png | 8 | 7 | 9 | Y | N | N | Y | 绿色圆形目标（右上）与背景条纹对比度偏低，眯眼时易混淆为背景；‘Sewer Inlet’标签位置偏上且无明确指向，可能被误认为装饰文字；玩家角色头顶无高亮/轮廓强化，在深绿背景下辨识度中等 |
| tests/final/05-dark.png | 6 | 5 | 8 | Y | N | N | Y | 玩家角色（左下小蓝块）太小且亮度低，与背景对比度不足，易被忽略；‘Black Tunnel’标题居中但无明确指引性，未说明当前关卡机制或目标；右上角‘STEAM’和‘Small’按钮语义不明，可能为调试残留 |
| tests/final/06-factory.png | 8 | 9 | 10 | Y | N | N | Y | 左下尖刺陷阱无明显警示标识，易误触；右上红色圆形光源（疑似太阳/月亮）与‘Factory Gate’标题间距过近，视觉干扰；‘STEAM’标签语义不明，未说明用途 |
| tests/final/07-finale.png | 8 | 7 | 9 | Y | N | N | Y | 玩家角色与地面平台对比度偏低，眯眼时易与背景柱子混淆；右上角‘Small’按钮文字过小（约10px），在低分辨率下可能难辨；红色圆形光源无明确功能指示，易误判为敌人或障碍 |
| tests/final/08-mobile-play.png | 8 | 7 | 9 | Y | N | N | Y | 玩家角色与地面砖块对比度偏低，眯眼时易混淆轮廓；左上角HUD文字（LEVEL/COINS/LIVES）字号偏小，远距离辨识稍弱；右上角'STEAM'和'Small'按钮无明确功能提示，语义模糊 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

