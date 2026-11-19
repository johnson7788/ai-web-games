# 截图自动评审 — elite-gunstrike

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.5 / silhouette 7.5 / style 8.9

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 标题 'ELITE GUNSTRIKE' 发光效果过强，导致部分字母边缘轻微晕染，影响远距离辨识；‘Best sector 1’ 和 ‘Total stars 0’ 字体颜色（黄/粉）与深背景对比度偏低，弱光环境下可能难读；无玩家/敌人/子弹等游戏内元素可见，无法评估 silhouette 中的可交互物区分度 |
| tests/final/02-play.png | 7 | 8 | 9 | Y | N | N | Y | 顶部绿色能量条与中央小灰点轻微重叠，可能干扰目标定位；两个橙色三角目标上方红色感叹号图标过小，远距离辨识度低；左上角‘TARGETS 2’未明确指示是剩余还是总数，易歧义 |
| tests/final/03-combat.png | 7 | 8 | 9 | Y | N | N | Y | 左上角‘TARGETS 2’与‘COMBO 1’间距过小，易误读；中央‘Neon Foundry’标题无背景遮罩，网格线透出影响辨识；右上‘BOLTS 4’与‘REACTOR 25’标签框样式不一致（前者圆角后者直角） |
| tests/final/04-explosion.png | 8 | 7 | 9 | Y | N | N | Y | 三个橙色目标物上方的红色感叹号图标过小且易与目标混淆，可能误判为状态而非警告；‘Crimson Reactor’标题框无背景遮罩，在深色网格上对比度略低，远距离阅读稍吃力；左上角HUD信息（Sector/Score等）字体偏小，3秒内需聚焦才能辨清数值 |
| tests/final/05-reactor.png | 7 | 8 | 9 | Y | N | N | Y | 顶部‘Crimson Reactor’标题与上方六边形敌人轻微视觉干扰，可能误判为可交互目标；左上角‘TARGETS 3’未明确指示当前剩余目标数量（如是否已击中）；右下蓝色菱形+号图标功能不明，无提示且与敌方六边形形状相似易混淆 |
| tests/final/06-captive.png | 7 | 8 | 9 | Y | N | N | Y | 顶部‘Neon Foundry’标题与中央橙色目标物轻微视觉干扰，可能误判为可交互对象；左上角HUD信息（如TARGETS 3）字体偏小，弱光环境下辨识度略低；两个红色三角敌人上方的感叹号图标尺寸过小，易被忽略 |
| tests/final/07-citadel.png | 7 | 8 | 9 | Y | N | N | Y | 顶部‘Violet Citadel’标题下方有模糊虚线，疑似未对齐或渲染异常；左上角‘TARGETS 5’与‘COMBO 0’间距过小，易误读为‘COMBO 0 TARGETS 5’；两个橙色圆形敌人带感叹号图标，但无明确提示其为‘需优先处理’目标，语义模糊 |
| tests/final/08-mobile-play.png | 8 | 7 | 9 | Y | N | N | Y | 红色三角目标上方感叹号过小，眯眼时易与目标融合，影响 silhouette 辨识；左上 HUD 按钮组间距紧凑， combo 和 targets 数值字号略小，3秒内需稍聚焦才确认数值；网格背景线过细且颜色偏暗，部分区域与粒子特效重叠时轻微干扰目标定位 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

