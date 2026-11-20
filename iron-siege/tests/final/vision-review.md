# 截图自动评审 — iron-siege

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.3 / silhouette 6.9 / style 8.8

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 左上角小图标（疑似玩家/单位轮廓）太小且模糊，眯眼时难以辨识为可交互元素；‘Best wave 1’文字颜色偏淡、字号小，与背景对比度不足，易被忽略；右上角语言切换下拉框无展开箭头或视觉反馈，可能被误认为静态文本 |
| tests/final/04-play.png | 8 | 7 | 9 | Y | N | N | Y | 玩家 mech（蓝框）与下方橙色炮台视觉相似度高，易混淆；；右下角 Weld 按钮无悬停反馈，且文字‘Weld’与背景对比度偏低；；‘CORE FURNACE 8/8’进度条右侧数字‘8/8’紧贴边框，有轻微裁切风险 |
| tests/final/06-dead.png | 8 | 6 | 9 | Y | N | N | Y | 背景地图像素块模糊，玩家单位（左下蓝圈）与地形对比度低，影响 silhouette 辨识；‘Press R to deploy again’提示文字较小且无高亮，易被忽略；‘Best wave’值为1但‘Wave reached’也为1，逻辑上可能引起困惑（是否应为0？） |
| tests/final/07-restart.png | 8 | 7 | 9 | Y | N | N | Y | 左下角玩家 mech 图标与橙色按钮紧贴，可能误触；；‘CORE FURNACE’进度条文字与数值（8/8）间距过小，易误读；；敌人（绿色方块）与可焊结构（浅蓝方块）颜色对比度低，辨识稍弱 |
| tests/final/08-mobile-play.png | 7 | 8 | 9 | Y | N | N | Y | 右侧面板‘CORE FURNACE’进度条文字与数值间距过小，易误读为‘8/88’；左下角三个圆形按钮无图标/标签，功能不明确（可能为技能/切换）；地图中绿色方块（资源？）与棕色地形色差不足，远距离辨识度低 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 左下角玩家 mech 与两个圆形 UI 元素（蓝色/橙色）紧贴，可能误触；；‘CORE FURNACE’进度条数值‘8/8’右侧无空隙，易被误读为‘8/80’；；敌人（绿色方块）与可焊结构（浅蓝方块）颜色对比弱，眯眼时难区分 |
| tests/final/tutorial-first.png | 9 | 8 | 9 | Y | N | N | Y | 右侧面板‘CORE FURNACE’进度条文字与橙色条轻微重叠（视觉干扰）；左上角提示框边框与背景像素块纹理略不协调，存在轻微拼接感；‘HOSTILES LEFT: 6’数值未加粗，与上方‘HEAVY SHELLS: 4’对比度偏低 |
| tests/final/tutorial-replay.png | 9 | 6 | 8 | Y | N | N | Y | 左上角教程框与标题‘IRON SIEGE’间距过近，视觉干扰；；‘Best wave 1’文字偏小且无强调，易被忽略；；背景模糊圆环元素与主界面风格略冲突，疑似占位符残留 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

