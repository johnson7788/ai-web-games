# 截图自动评审 — rally-dust-3d

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.2 / silhouette 6.6 / style 7.6

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 8 | 7 | 9 | Y | N | N | Y | 标题‘RALLY DUST 3D’下方小字‘Point-to-point rally · pace notes · mud drift’在深背景上对比度偏低，弱光下可能难读；红色车模型部分遮挡‘BEST’标签与‘Damage 100% = DNF’提示，存在轻微视觉干扰；右上角语言选择与静音按钮间距过近，且‘Mute’按钮无悬停反馈提示（截图静态无法确认交互） |
| tests/final/mobile.png | 8 | 7 | 9 | Y | N | N | Y | 标题‘RALLY DUST 3D’红白描边在深灰背景上对比度略低，部分字母边缘轻微模糊；红色小车模型位于文字下方，但未明确标识为玩家车辆，需依赖上下文推断；右上角语言切换与静音按钮间距过近，可能误触（桌面截图不扣分，但属潜在UX问题） |
| tests/final/tutorial-after-skip.png | 8 | 7 | 6 | Y | N | N | Y | HUD中'PACE NOTE'右侧进度条过短且无刻度，难以判断当前节奏状态；远处终点拱门与背景山体对比度低，目标虽可见但辨识度不足；车辆后部黑色区域与红色车身色差小，轮廓在远距离易混淆 |
| tests/final/tutorial-first.png | 8 | 7 | 6 | Y | N | N | Y | 右上角教程弹窗遮挡部分远景与赛道终点线，影响目标感知；HUD 中 'PACE NOTE' 进度条无明确刻度或单位，语义模糊；车辆与地面材质风格不一致（低多边形车体 vs 纹理地面），存在拼接感 |
| tests/final/tutorial-replay.png | 9 | 5 | 8 | Y | N | N | Y | 背景文字‘RALLY DUST 3D’模糊且与教程框重叠，可能干扰焦点；教程框顶部三点指示器未明确当前步骤（如高亮第1点），易造成认知负担；‘Next’按钮为浅棕底白字，对比度偏低，弱光环境下可读性下降 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

