# 截图自动评审 — arcade-treasure

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.3 / silhouette 6.3 / style 8.4

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-hall.png | 8 | 7 | 9 | Y | N | N | Y | 顶部'GRAND PRIX'文字模糊且部分被遮挡，影响品牌识别；三个柜子下方描述文字字号偏小，在低分辨率下可能难读；绿色柜子内三个笑脸图标间距过密，眯眼时易误判为单个元素 |
| tests/final/02-mole.png | 7 | 8 | 9 | Y | N | N | Y | 左上角HUD‘HEAT ×1.0’与‘RANK 1’间距过小，易误触；右上角‘TIME 22’与‘TARGET 250’垂直排列紧凑，小屏可能阅读困难；玩家角色（带眼睛图标）与其他空圆圈视觉差异仅靠内部图标，无尺寸/亮度强化，新手可能混淆 |
| tests/final/03-rain.png | 7 | 6 | 8 | Y | N | N | Y | 目标文字 'Meet the three cabinets and the token door' 语义模糊，与当前界面元素（光点、平台）无直接关联，易误导；金色光点（token）与背景雨线对比度低，眯眼时易混淆为背景粒子；左上角 HUD 按钮（TOKENS/RANK/HEAT）间距过密，小屏可能误触 |
| tests/final/04-swarm.png | 8 | 7 | 9 | Y | N | N | Y | 顶部标题文字‘Gremlin vents split: safe targets vs sparking hazards’字号偏小，弱对比下易忽略；左上角HUD按钮（TOKENS/RANK/HEAT）间距过密，可能误触；紫色方块目标与背景星点对比度偏低，远距离辨识稍难 |
| tests/final/05-grandprix.png | 7 | 4 | 8 | Y | N | N | Y | 中央‘GRAND PRIX’标题与下方提示文字重叠，视觉干扰；提示文字背景为深色圆角矩形，但与标题发光效果冲突；底部三个任务卡片文字过小（尤其副标题），在低分辨率下易误读，且紫色文字与深紫背景对比度不足；‘TOKENS 5’和‘RANK 1’按钮无明确交互反馈样式，玩家可能不确定是否可点 |
| tests/final/06-mobile.png | 6 | 5 | 7 | Y | N | N | Y | 目标文字 'Meet the three cabinets and the token door' 与玩家/目标物无视觉关联，易误读为提示而非任务；三个发光圆点（含闪电）外形相似、亮度接近，难以快速区分功能（玩家/敌人/可收集物）；HUD 左上角 'HEAT ×1.0' 字体过小且无图标辅助，桌面环境下仍难快速识别 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 顶部'GRAND PRIX'文字模糊且部分被遮挡，影响品牌识别；三个柜子下方描述文字字号偏小，在低分辨率下可能难读；绿色柜子内三个笑脸图标间距过密，眯眼时易误判为单个元素 |
| tests/final/tutorial-first.png | 7 | 6 | 8 | Y | N | N | Y | 中间柜子下方提示文字‘Tap a cabinet to drop in your token’与上方‘Tap a cabinet to play · 1 token’语义重复且位置冲突，易混淆；左侧‘Server Night Watch’图标中三个笑脸符号无明确交互反馈指示，玩家可能误以为需点击笑脸而非底部方块；右侧紫色柜子内四个圆点符号样式模糊，与‘Gremlin vents split’描述关联性弱，难以快速理解机制 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

