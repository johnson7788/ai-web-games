# 截图自动评审 — sword-saga

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.5 / silhouette 6.8 / style 8.6

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-map-bamboo.png | 7 | 6 | 8 | Y | N | N | Y | 玩家角色与左侧小橙色物体（可能是宠物/道具）轮廓相似、亮度接近，易混淆；中间感叹号目标图标无明确交互提示（如高亮边框或脉动），仅靠光晕不够醒目；右上角‘SEALED’标签文字与背景对比度偏低，部分像素模糊 |
| tests/final/02-dialog.png | 8 | 7 | 9 | Y | N | N | Y | 玩家角色（白色小人）与橙色小物体重叠，易误判为单一实体；‘BATTLE’区域无明确敌人轮廓，仅靠文字提示，战斗触发点辨识度低；对话框底部‘Next’按钮与背景深色块对比不足，弱光下可能难辨 |
| tests/final/03-battle.png | 7 | 8 | 9 | Y | N | N | Y | 左上角 'CHAPTER 1/12' 和 'REALM Green Bamboo Forest' 文字间距过小，略显拥挤；Bamboo Wraith 血条下方 'WOOD' 标签字体偏小，与上方 '90/90' 对齐不一致；Fox.name 的 FIRE 属性标签颜色（红）与 Hero.name 的 METAL（蓝绿）对比度高，但未明确指示其是否可操作或状态 |
| tests/final/04-target-select.png | 8 | 7 | 9 | Y | N | N | Y | 右侧敌人血条上方红色感叹号与血条间距过小，易误读为血条一部分；‘YOUR TURN’黑底黄字与下方角色图标间距紧凑，部分玩家可能忽略状态提示；左上角‘Arrows to walk · Click to interact’文字偏小且灰度高，3秒内不易捕捉 |
| tests/final/05-boss.png | 8 | 7 | 9 | Y | N | N | Y | ‘YOUR TURN’标签与Hero.name重叠轻微，可能影响阅读节奏；Bamboo King头顶感叹号图标偏小且无说明，新手可能忽略其警示含义；Fox.name下方FIRE标签颜色（红）与血条绿色对比弱，易误读为状态而非属性 |
| tests/final/06-snow.png | 7 | 6 | 8 | Y | N | N | Y | 玩家角色与左侧小橙色物体（疑似宠物/道具）轮廓相似、亮度接近，易混淆；‘SEALED’门框文字偏小且无背景衬底，在深蓝格子背景下辨识度低；中间感叹号目标图标未明确指示交互方式（如点击/靠近），仅靠光晕暗示 |
| tests/final/07-tower.png | 7 | 6 | 8 | Y | N | N | Y | 玩家角色（左下）与橙色小物体重叠，轮廓辨识度低；；‘SEALED’门框文字偏小且无背景衬底，暗背景下易误读；；感叹号目标图标发光过弱，与深紫网格对比不足，远距离难识别 |
| tests/final/08-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 玩家角色与左侧小物件（烟斗？）视觉区分度低，易误判为可交互物；‘SEALEd’门框标签字体过小且无背景衬底，远距离难辨识；中央提示框遮挡部分路径网格，轻微影响空间判断 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

