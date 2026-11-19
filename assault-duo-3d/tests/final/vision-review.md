# 截图自动评审 — assault-duo-3d

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 7.3 / style 8.9

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 7 | 8 | Y | N | N | Y | 底部敌人/障碍物剪影较暗，与背景对比度低，眯眼时易混淆（尤其左侧绿色菱形与蓝色方块）；右上角语言选择框边框过细且无悬停反馈，可能被误认为装饰元素；‘F for DUO BLAST’文字字号略小，与上方控制说明行距不均，轻微影响扫读节奏 |
| tests/final/02-title-zh.png | 9 | 7 | 8 | Y | N | N | Y | 玩家角色（左下蓝块）与背景建筑轮廓相似，眯眼时辨识度偏低；右上语言选择框‘中文’文字略小且无悬停反馈，可能影响可访问性；底部平台上的红色/橙色圆柱体与UI按钮颜色相近，易混淆为可交互元素 |
| tests/final/03-playing.png | 8 | 9 | 10 | Y | N | N | Y | 右上角'HOW TO PLAY'文字与图标间距过小，可能误触；HP与DUO BLAST条无明确标签，新手需猜测含义；左下绿色菱形目标指示器与玩家角色距离较远，易忽略 |
| tests/final/04-action.png | 7 | 8 | 9 | Y | N | N | Y | HP 和 DUO BLAST 条无明确数值标签，仅靠颜色区分状态，新手可能误判剩余量；右上角 'HOW TO PLAY' 按钮文字过小且与图标间距紧凑，易误触或忽略；绿色菱形目标指示器（左）与玩家角色距离较近，可能被误认为可拾取物而非目标标记 |
| tests/final/05-result.png | 8 | 6 | 9 | Y | N | N | Y | 左下角玩家角色与背景建筑轮廓相似，眯眼时不易区分（silhouette偏低）；‘AREA CLEARED’文字无描边/阴影，在深蓝背景下对比度略低；右上角紫色圆形光晕疑似UI元素但功能不明，可能造成干扰 |
| tests/final/tutorial-after-skip.png | 7 | 8 | 9 | Y | N | N | Y | 左下角绿色菱形目标图标与玩家角色距离过近，易误判为敌人或障碍；HP与DUO BLAST条无明确标签分隔，可能混淆状态含义；右上‘HOW TO PLAY’文字与图标间距过小，移动端易误触 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 教程弹窗遮挡左下角玩家角色（NOVA）和绿色目标指示器，影响空间感知；‘HOW TO PLAY’标题与右上角同名按钮重叠视觉层级，易混淆；HP/DOO BLAST条无明确数值或单位，新手难判断当前状态 |
| tests/final/tutorial-replay.png | 8 | 6 | 9 | Y | N | N | Y | 背景中紫色圆形光斑与标题文字亮度接近，可能干扰主标题辨识度；左下角绿色三角形图标和蓝色方块轮廓模糊，角色/敌人 silhouette 不清晰；‘HOW TO PLAY · 1/4’弹窗遮挡部分背景元素，虽非关键交互区，但影响视觉层次 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

