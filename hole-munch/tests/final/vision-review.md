# 截图自动评审 — hole-munch

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 6.9 / style 8.6

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 背景中模糊的圆形/矩形元素（疑似敌人或洞）与标题文字亮度接近，眯眼时难以区分玩家与环境元素；‘Best rank #6’为黄色小字，对比度偏低，在深色背景下易被忽略；右上角语言选择下拉框无展开箭头图标，交互意图不明确 |
| tests/final/02-play.png | 7 | 8 | 9 | Y | N | N | Y | 左上角'RANK #1'与'TIME 1:58'间距过小，易误读为'RANK #1 TIME'；底部'CHAIN'进度条文字与条形图紧贴，小屏可能混淆；‘YOU’标签轻微遮挡中心玩家圆环顶部边缘（约1px） |
| tests/final/03-result.png | 9 | 6 | 8 | Y | N | N | Y | ‘NEW BEST RANK’按钮文字与背景对比度偏低，弱光下可能难辨；‘Top 3 — advance!’提示字号过小，易被忽略；底部三个成长选项按钮间距紧凑，移动端易误触 |
| tests/final/04-mobile-play.png | 7 | 8 | 9 | Y | N | N | Y | ‘YOU’标签文字略小且无背景，弱光下可能难辨；右上角‘Goal: Top 3’与时间/排名信息间距过近，易误读；底部‘CHAIN 0/10’进度条无明确起止标识，功能意图模糊 |
| tests/final/05-title-zh.png | 8 | 6 | 9 | Y | N | N | Y | ‘最佳名次 #6’文字偏小且颜色较淡，易被忽略；；背景抽象几何图形与主标题存在轻微视觉干扰，影响目标聚焦；；‘YOU’标签及环形指示器位置模糊，未明确关联玩家角色（当前仅标题页，无实际角色） |
| tests/final/tutorial-after-skip.png | 7 | 8 | 9 | Y | N | N | Y | ‘CHAIN 0/10’进度条过窄且无标签说明，易被忽略；左下角‘Old Town’按钮无明显交互反馈样式，与背景对比度偏低；玩家标识‘YOU’标签轻微遮挡其自身圆环上缘，存在微小重叠 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 玩家角色（YOU）与附近白色光点密集重叠，易误判为可收集物；左上角'RANK #1 TIME 2:00 SIZE 8'中'SIZE 8'字号偏小且无分隔，易与TIME混淆；底部'CHAIN 0/10'进度条过窄，视觉权重低，与教程框距离近易被忽略 |
| tests/final/tutorial-replay.png | 9 | 6 | 8 | Y | N | N | Y | 背景中模糊圆环（疑似洞口）与标题文字亮度接近，眯眼时难以区分可交互物与装饰元素；‘Best rank #6’颜色偏黄且字号小，与主标题对比度不足，易被忽略；右上角‘Skip’按钮无明确视觉层级，与语言切换下拉菜单间距过近，可能误触 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

