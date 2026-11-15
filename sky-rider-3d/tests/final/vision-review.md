# 截图自动评审 — sky-rider-3d

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 6.2 / style 7.8

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 9 | 7 | 8 | Y | N | N | Y | ‘BEST’标签下黄色高亮边框与背景云层对比度偏低，可能影响快速识别；红色飞机模型在云墙前略显模糊，轮廓锐度不足（silhouette扣分原因）；底部控制提示文字字号偏小，远距离阅读易混淆（如‘W/S pitch’等） |
| tests/final/mobile.png | 9 | 7 | 8 | Y | N | N | Y | 红色飞机模型在云墙后半遮挡，轮廓辨识度略低（silhouette扣分）；‘BEST’标签下划线为虚线但颜色过淡，易被忽略；背景云墙纹理重复明显，有拼接感（影响style_consistent） |
| tests/final/tutorial-after-skip.png | 7 | 6 | 8 | Y | N | N | Y | 黄色环形目标与背景云纹图案对比度低，部分环在远处易混淆；玩家角色（彩色小车）轮廓较细，与地面颜色接近，眯眼时辨识度不足；左上角RANK 8与右上角LAP/RING信息间距过近，视觉层级弱 |
| tests/final/tutorial-first.png | 7 | 6 | 8 | Y | N | N | Y | 玩家角色（白色球体）与前方红色平台几乎同高，轮廓在绿色地面背景下对比不足，易误判位置；左上角RANK 8与右上角LAP/RING信息间距过近，视觉层级混乱；底部操作提示文字‘W / S to dive and climb...’与GOT IT/SKIP按钮紧贴，小屏可能误触 |
| tests/final/tutorial-replay.png | 8 | 5 | 7 | Y | N | N | Y | 背景云层与平台纹理重复拼接明显，有网格感，影响沉浸感；玩家角色（小黑点）在远处几乎不可辨， silhouette 分辨率低；提示框居中但未适配宽屏比例，左右留白过大，视觉重心偏上 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

