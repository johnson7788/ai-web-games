# 截图自动评审 — space-wave-3d

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 7.4 / style 9.0

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 8 | 7 | 9 | Y | N | N | Y | ‘BEST 0’数字‘0’颜色为橙色，与主色调（青蓝）不一致，易被忽略；背景星云与前景环形波纹层次略混，眯眼时玩家立方体与环线对比度不足；‘HOW TO PLAY’按钮边框为细线，视觉权重低于 LAUNCH，但功能同等重要 |
| tests/final/mobile.png | 8 | 7 | 9 | Y | N | N | Y | ‘BEST 0’中数字‘0’为橙色，与主色调青蓝不一致，略突兀；背景星云与中心隧道环线在视觉上略有融合，降低玩家立方体轮廓对比度；‘HOW TO PLAY’按钮边框为青蓝细线，与LAUNCH实色块风格稍异，一致性可提升 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 中心目标圆环内有像素块干扰，可能误判为可收集物；底部操作提示文字较小（约12px），在低分辨率屏可能难读；左上角‘x1’倍率标识颜色与背景对比度偏低（黄底黑字但背景暗紫） |
| tests/final/tutorial-first.png | 8 | 9 | 9 | Y | N | N | Y | 左上角 'x1' 倍率标识颜色过小且与分数紧邻，易误读为分数一部分；底部提示栏左侧圆点指示器无明确语义，新手可能忽略；右上角 'S1' 标签图标与文字间距过窄，视觉拥挤 |
| tests/final/tutorial-replay.png | 8 | 7 | 9 | Y | N | N | Y | 底部提示栏‘HOLD SPACE (or touch) to rise.’中‘(or touch)’在桌面环境下易误导，应区分平台；‘BEST 0’分数显示字号过小且无背景衬底，弱光下可能难辨；中心立方体与同心圆波纹视觉层次接近，眯眼时玩家轮廓不够突出 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

