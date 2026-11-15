# 截图自动评审 — tower-climb

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.6 / silhouette 6.4 / style 8.4

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 9 | 6 | 8 | Y | N | N | Y | 背景中央竖条光效与标题文字轻微融合，可能影响远距离辨识度；‘How to play’按钮边框为青色细线，在深色背景下对比度偏低；右上角语言选择下拉框无展开箭头图标，交互意图不明确 |
| tests/final/mobile.png | 9 | 6 | 8 | Y | N | N | Y | 背景中垂直光带与标题文字轻微重叠，可能影响‘TOWER’和‘CLIMB’字形辨识度；‘How to play’按钮边框为细线，低对比度下易被忽略，且无悬停反馈提示；底部操作说明字体过小（约10px），在非高清屏上可能难以阅读 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 紫色路径与青色障碍物对比度偏低，眯眼时易混淆边界；左上角HUD按钮文字‘Reach the top’无图标辅助，新手可能忽略目标提示；右上角‘Best —’未显示数值，信息不完整 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 右下角提示框边框发光过强，轻微干扰背景路径辨识；左侧HUD按钮‘Reach the top’图标与文字间距过小，略显拥挤；紫色路径与青色侧墙对比度偏低，眯眼时边缘易混淆 |
| tests/final/tutorial-replay.png | 9 | 6 | 8 | Y | N | N | Y | 目标三角图标与文字‘Reach the top’间距过小，易误读为标题装饰；WASD / 左摇杆提示中图标（红色摇杆）尺寸过小且对比度低，辨识度不足；整体UI居中悬浮，无背景遮罩，深色背景下边缘光晕可能干扰视线 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

