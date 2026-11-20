# 截图自动评审 — helix-orbit

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 6.1 / style 8.8

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 中央提示框遮挡塔体中心交互点（白色小球）；右上角'ICE 0'与'Skip'按钮间距过小，可能误触；塔体分层边缘线宽不一致，部分切片边界模糊 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 中央提示框遮挡塔身关键缺口区域，影响操作判断；左上角HUD按钮间距过小（DEPTH/SCORE/BEST），可能误触；‘Skip’按钮无悬停反馈，且与ICE计数器视觉层级冲突 |
| tests/final/tutorial-replay.png | 8 | 6 | 9 | Y | N | N | Y | 标题 'HELIX ORBIT' 发光效果过强导致部分字母边缘模糊，影响远距离辨识；‘Best depth 1’ 文字字号偏小且颜色较浅，与背景对比度不足；底部提示框（FIRST DESCENT）无圆角/阴影，与上方按钮风格略有差异 |
| tests/final/v02-title-zh.png | 8 | 5 | 9 | Y | N | N | Y | 背景模糊螺旋结构与文字‘HELIX ORBIT’在视觉上易混淆，眯眼时难以区分UI与场景元素；‘最深 0 层’文字较小且颜色偏淡，对比度不足，影响快速阅读；右上角语言切换按钮无悬停反馈提示，交互意图不明确 |
| tests/final/v03-tutorial.png | 8 | 7 | 9 | Y | N | N | Y | 中央提示框遮挡塔顶小黄点（目标指示器），影响目标定位；‘FIRST DESCENT’标题与步骤说明字体大小差异略大，层级稍乱；背景星点过密且亮度接近塔体暗部，弱化塔体轮廓（silhouette扣分原因） |
| tests/final/v04-play.png | 6 | 7 | 9 | Y | N | N | Y | 目标光点（中心白圈）亮度不足，与深色背景对比度偏低，易被忽略；左上角HUD按钮文字‘BEST 0’无单位说明，语义模糊；紫色螺旋结构层次复杂，部分片段遮挡中心目标，影响路径判断 |
| tests/final/v05-paused.png | 9 | 4 | 8 | Y | N | N | Y | 背景模糊角色轮廓难以辨识，眯眼时无法区分玩家/敌人/可交互物；‘Paused’标题与下方提示文字间距偏小，略影响层级清晰度；右上角语言切换下拉框无展开指示（如小三角），可能被误认为静态标签 |
| tests/final/v06-dead.png | 9 | 6 | 8 | Y | N | N | Y | 背景模糊紫色光带与HUD边缘轻微融合，可能影响视觉聚焦；‘NEW RECORD’徽章无明确交互反馈提示（如悬停/点击态）；‘Press R to launch again’文字字号偏小，低对比度下易被忽略 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

