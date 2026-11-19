# 截图自动评审 — bubble-shooter-pop

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.1 / silhouette 8.8 / style 9.5

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-play-basic.png | 8 | 9 | 10 | Y | N | N | Y | 顶部HUD中'WAVE 1'与'COMBO ×0'间距过小，易误读为'WAVE1COMBO'；右上角三个图标（?、空框、U、锁）无文字说明，功能不明确；黄色球体亮度显著高于粉色球体，可能误导玩家优先目标 |
| tests/final/02-play-rock.png | 8 | 9 | 10 | Y | N | N | Y | 顶部HUD中'COMBO ×0'与'MISS 0/6'间距过小，易误读为'COMBO×0MISS'；紫色球体上的数字'5'字体略小且无描边，在深色背景上对比度偏低；底部玩家发射器图标与地面条带颜色接近（均为暗红），边界不够清晰 |
| tests/final/03-play-gold.png | 8 | 9 | 10 | Y | N | N | Y | 顶部HUD中'COMBO x1'与'MISS 0/6'间距过小，易误读为'COMBO x1MISS'；右上角三个图标（?、空框、U、铃铛）无文字说明，功能不明确；粉色球体与敌人垂直对齐但无轨迹提示，新手可能不确定是否需预判 |
| tests/final/04-play-bomb.png | 8 | 9 | 9 | Y | N | N | Y | 顶部HUD中'COMBO x1'与'MISS 0/6'之间间距过小，易误读为'COMBO x1MISS'；右上角'?'按钮无悬停提示，且图标语义模糊（可能被误认为设置）；红色球体上的数字'2'字体略小，在快速移动时可能辨识困难 |
| tests/final/05-play-mix.png | 8 | 9 | 9 | Y | N | N | Y | 顶部HUD中'COMBO x1'与'MISS 0/6'之间间距过小，易误读为'COMBO x1MISS'；紫色5号球体内部箭头图标与数字5轻微重叠，影响辨识；右上角'?'按钮无悬停提示或说明，功能不明确 |
| tests/final/06-play-powerup.png | 8 | 9 | 10 | Y | N | N | Y | 顶部HUD中'COMBO x1'与'MISS 0/6'间距过小，易误读；中间黄色闪电图标与右侧小矩形图标功能不明，无提示；底部玩家图标与深色底栏融合度高，边缘对比略弱 |
| tests/final/07-play-triple.png | 8 | 9 | 10 | Y | N | N | Y | 顶部HUD中'COMBO x1'与'MISS 0/6'间距过小，易误读为'COMBO x1MISS'；绿色球下方三个小光点位置偏高，可能被误认为是目标而非指示器；底部玩家图标发光过强，与背景网格线对比度低，弱光环境下可能辨识困难 |
| tests/final/08-title.png | 9 | 7 | 8 | Y | N | N | Y | 底部玩家图标（发射器）与标题文字垂直距离过近，可能在小屏设备上产生视觉干扰；‘Dodge the falling bubbles...’提示文字字号偏小、颜色偏淡（粉红），在深色背景下对比度不足；右上角语言切换按钮边框为青色，与主标题风格一致但未加阴影/发光，略显突兀 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

