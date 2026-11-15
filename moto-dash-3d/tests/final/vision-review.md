# 截图自动评审 — moto-dash-3d

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.4 / silhouette 6.8 / style 8.6

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 9 | 7 | 8 | Y | N | N | Y | ‘BEST 0 m’文字偏小且颜色较淡，易被忽略；；背景道路纹理与前景 HUD 对比度偏低，眯眼时玩家轮廓（车把）不够突出；；右上角语言/音量控件无图标仅文字，移动端可能误触或辨识困难 |
| tests/final/mobile.png | 9 | 7 | 8 | Y | N | N | Y | ‘BEST 0 m’文字偏小且颜色较淡，易被忽略；背景道路纹理与前景按钮对比度不足，部分区域略显模糊；顶部语言/音效控件位置偏右上角，但未明确标注为设置项 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 玩家车体（黄色平台）与路面纹理对比不足，远距离辨识度偏低；左上角SCORE 15与右上角速度/距离信息字体大小不一致，视觉层级混乱；远处两辆敌车颜色相近（红白/蓝黑），在高速下易混淆 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 右上角速度/距离数值（92 KM/H, 18 m）与‘DAY’标签排版拥挤，易误读；提示框内‘Hold W or tap to accelerate...’未说明‘tap’是触屏操作，桌面端语义模糊；玩家视角前方黄色平台与道路纹理对比弱，初期可能误判为路面而非载具 |
| tests/final/tutorial-replay.png | 8 | 6 | 9 | Y | N | N | Y | 教程弹窗遮挡部分标题'MOTO DASH 3D'，影响品牌识别；背景道路网格在暗光下细节模糊，眯眼时玩家车辆轮廓不够突出；‘START’和‘HOW TO PLAY’按钮与弹窗底部间距过小，视觉层级易混淆 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

