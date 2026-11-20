# 截图自动评审 — alien-siege

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.5 / silhouette 7.1 / style 9.1

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 背景模糊角色轮廓与标题重叠，眯眼时玩家/敌人 silhouette 不清晰；‘Best wave 0’黄色文字与深紫背景对比度偏低，易被忽略；右上角语言切换下拉框无展开指示（小三角），交互意图不明确 |
| tests/final/02-marker.png | 9 | 8 | 10 | Y | N | N | Y | 中央目标区域无明确敌人/障碍物标识，仅靠靶心暗示目标，可能误判为纯训练靶；底部玩家武器轮廓过小，与背景对比度低，眯眼时易与地面混淆；左上角HP/SHIELD/Ammo三栏间距紧凑，小屏可能误触 |
| tests/final/03-shield.png | 9 | 8 | 10 | Y | N | N | Y | 中央目标区域无明确敌人/障碍物标识，仅靠靶心暗示目标，可能误判为纯训练靶；左上角HP/SHIELD/Ammo数值与条形图对齐不一致（HP 76偏右，SHIELD 100居中，AMMO 12/12偏左）；‘Wave 1/12’与‘Colonial Alley’文字字号/颜色层级弱，易被忽略 |
| tests/final/04-boss.png | 8 | 9 | 10 | Y | N | N | Y | 波数/地点文字（'Wave 1/12', 'Colonial Alley', 'MOTHER NEST'）垂直堆叠紧凑，小屏可能难辨层级；HP/SHIELD/Ammo数值与条形图间距过小，低对比下易混淆；中央目标外圈光晕略强，可能干扰对准精度（尤其在暗背景中） |
| tests/final/05-dead.png | 9 | 6 | 8 | Y | N | N | Y | ‘NEW RECORD’高亮框与标题‘SIEGE BROKEN’间距过小，视觉拥挤；‘Best wave’值为2但‘Wave reached’也为2，逻辑易混淆（可能应为‘Best wave’≥当前波数）；背景模糊导致整体对比度偏低，眯眼时UI元素与背景区分度不足 |
| tests/final/06-restart.png | 8 | 7 | 9 | Y | N | N | Y | 中央目标（白色圆点）与粉色门框对比度偏低，弱光下可能难辨；底部玩家视角仅显示枪口轮廓，缺乏角色/武器明确剪影；‘Colonial Alley’地图名字体过小且无背景衬底，远距离易误读 |
| tests/final/07-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 敌人目标（青色方块）中心眼状图案与准星重叠，可能干扰瞄准判断；左上角 HP/SHIELD/Ammo 标签文字偏小，弱光环境下辨识度略低；‘Colonial Alley’关卡名使用紫色描边但无背景，深紫背景下对比度不足 |
| tests/final/tutorial-after-skip.png | 8 | 6 | 9 | Y | N | N | Y | 玩家角色（底部紫色条）与准星重叠，视觉重心不明确；；通道中无敌人/目标物显示，仅靠‘Wave 1/12’推断需防守，目标具体位置不直观；；‘Colonial Alley’文字颜色偏淡（浅紫），在深紫背景上对比度不足，易被忽略 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

