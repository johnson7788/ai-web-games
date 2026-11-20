# 截图自动评审 — constellation-line

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 9.0 / silhouette 7.8 / style 9.8

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/g1-play.png | 9 | 8 | 10 | Y | N | N | Y | 顶部‘CONNECT EVERY LINE ONCE’文字与计时器轻微重叠（时间条上方有橙色小点）；右上月亮图标与‘STEPS 2’按钮间距过近，可能误触；当前高亮点（黄色环）与连线端点视觉权重接近，易混淆操作焦点 |
| tests/final/g2-play-late.png | 9 | 8 | 10 | Y | N | N | Y | 顶部计时器下方进度条过细且颜色对比弱（橙色条在深紫背景上易忽略）；‘Triangulum’标签文字偏小，与‘LEVEL 1’视觉层级不一致；右上角月牙图标与‘LINES LEFT 1’间距过近，可能误读为一个元素 |
| tests/final/g3-meteor.png | 9 | 8 | 10 | Y | N | N | Y | ‘Cygnus Wing’标签文字颜色（黄底黑字）与深蓝背景对比度偏低，弱光下可能难辨；当前高亮星点（带黄环）与已连线星点（白圈）视觉区分依赖细环，眯眼时易混淆；右上角‘STEPS 2’等HUD元素无阴影/背景，在浅灰条带区域可能轻微融合 |
| tests/final/g4-dual.png | 9 | 8 | 10 | Y | N | N | Y | 右上角‘LINES LEFT 2’与‘STEPS 4’按钮间距过小，易误触；月亮图标部分遮挡‘LINES LEFT’标签（轻微）；左侧‘Lyra Twin’标签背景色与主界面融合度高，对比度偏低 |
| tests/final/g5-waypoint.png | 9 | 8 | 10 | Y | N | N | Y | 右上角‘Reach the North Star’提示文字被月牙图标轻微遮挡（视觉干扰）；当前高亮星点（黄色圆环）与连线起点/终点视觉权重相近，可能混淆操作焦点；‘LINES LEFT 5’与‘MISSES 0’按钮间距过小，桌面端无问题，但若适配移动端易误触 |
| tests/final/g6-win.png | 9 | 7 | 8 | Y | N | N | Y | ‘NEW RECORD’标签发光效果过强，可能干扰星标与数值阅读；‘Steps’和‘Misses’均为0，但未说明是否为理想值（如‘Perfect!’提示缺失）；背景模糊光斑与UI边缘轻微融合，降低UI轮廓清晰度 |
| tests/final/g7-mobile.png | 9 | 8 | 10 | Y | N | N | Y | 右上角月亮图标与‘LINES LEFT 2’按钮轻微重叠（视觉干扰）；时间条下方进度条过窄，44s数值与进度条间距小，易误读；‘Triangulum’标签背景色与主界面对比度偏低，弱光下可能辨识困难 |
| tests/final/g8-title.png | 9 | 7 | 10 | Y | N | N | Y | ‘Stars 0 • Constellations 0/24’文字颜色偏淡（浅黄），在深紫背景下对比度略低，可能影响弱光环境可读性；右上角语言选择下拉框无展开箭头图标，交互意图不明确；标题‘CONSTELLATION LINE’发光效果过强，右侧有轻微光晕溢出至背景，可能干扰后续界面元素辨识 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

