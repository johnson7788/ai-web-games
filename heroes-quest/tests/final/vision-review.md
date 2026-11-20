# 截图自动评审 — heroes-quest

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.1 / silhouette 7.5 / style 8.9

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-map.png | 7 | 6 | 9 | Y | N | N | Y | 节点图标语义模糊：红色×、黄色?、紫色∞等符号未在界面说明其含义，易混淆；‘NODE 0/11’与‘CHAPTER Verdant March’间距过小，视觉上易误读为单行文本；底部提示文字‘Click a glowing node to march’字号偏小且无高对比背景，弱光下难辨 |
| tests/final/02-formation.png | 9 | 7 | 8 | Y | N | N | Y |  Formation面板中‘FRONT/MID/BACK’标签与英雄名之间间距过小，易误触；底部‘Confirm formation’按钮边框与背景对比度偏低，弱光下可能辨识困难；‘MIGHT’进度条无数值或单位，无法判断当前状态 |
| tests/final/03-battle.png | 8 | 9 | 10 | Y | N | N | Y | 右上角 'SUPPLIES 6' 的数字与背景对比度偏低，小字号易误读；底部行动按钮组无视觉反馈（如悬停/选中态），当前‘Your turn - Syl’未高亮对应按钮；红色敌人头顶感叹号过小，远距离可能被忽略 |
| tests/final/04-battle-zh.png | 8 | 9 | 10 | Y | N | N | Y | 左上角‘目标 2’数值与进度条紧贴，间距过小易误读；红色敌人头顶感叹号为红色，与角色颜色冲突，辨识度略低；‘军势’条无明确数值或单位，含义模糊（需结合上下文） |
| tests/final/05-upgrade.png | 9 | 7 | 8 | Y | N | N | Y | ‘MIGHT’进度条文字‘MIGHT READY’颜色过浅（黄底黑字反差不足），在低对比度环境下可能难辨；背景山丘与前景小树剪影层次较弱，眯眼时‘可交互升级面板’与背景融合度偏高，影响视觉优先级；左上角‘NODE 1/11’标签无明确指示作用，易被误认为状态而非导航节点 |
| tests/final/06-mobile.png | 7 | 8 | 9 | Y | N | N | Y | 左上角‘TARGETS 2’旁的两个小蓝点图标语义模糊，疑似目标计数但无明确图示说明；右上‘MIGHT’条下方黄色进度条极短，难以判断当前值；且未标注数值；底部行动按钮‘Expedition Might’文字略长，与其他按钮宽度不一致，视觉重心偏移 |
| tests/final/tutorial-after-skip.png | 9 | 7 | 8 | Y | N | N | Y |  Formation panel底部按钮‘Confirm formation’无明确视觉反馈（如悬停/按下态），可能影响操作确认感；角色标签（Kael/tank.cls等）字体较小且与背景对比度偏低，远距离阅读略吃力；背景山丘与前景UI之间缺乏深度分隔，轻微视觉干扰 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 阵型区域中‘FRONT/MID/BACK’标签与英雄名间距过小，易误读为单个词；‘MIGHT’进度条无数值或单位，无法判断当前状态；背景山丘与前景UI对比度偏低，部分玩家可能忽略底部地形细节 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

