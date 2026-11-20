# 截图自动评审 — donkey-hurdle

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.9 / silhouette 8.3 / style 9.6

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-play-dawn.png | 8 | 9 | 10 | Y | N | N | Y | ‘Silk Dawn’标题居中但无明确交互提示，可能被误认为装饰；距离20m与JARS 5/6数值较小，弱光环境下辨识度略低；罐子发光效果与障碍物视觉权重接近，可能混淆目标优先级 |
| tests/final/02-jump-hurdle.png | 8 | 9 | 10 | Y | N | N | Y | ‘Silk Dawn’标题文字偏小且无对比度，远距离易误读为装饰元素；距离/罐子/连击数值框背景色与沙漠色调接近，低对比度影响快速识别；右上角‘BEST 0 m’单位‘m’与左上‘20 m’字体大小不一致 |
| tests/final/03-high-wall.png | 8 | 9 | 10 | Y | N | N | Y | 距离显示'60 m'与'JARS 4/6'间距过小，易误读为'60m JARS'；‘Silk Dawn’标题字体略小且居中偏上，与太阳视觉权重冲突；角色背部罐子堆叠细节在小屏可能模糊，影响目标识别 |
| tests/final/04-pit.png | 7 | 8 | 9 | Y | N | N | Y | 距离显示'40 m'与'JARS 3/6'间距过小，易误读为'40 m JARS 3/6'；‘Silk Dawn’标题字体略小且居中偏上，与太阳视觉权重冲突；深坑边缘无警示标识，新手可能误判跳跃距离 |
| tests/final/05-oasis.png | 8 | 9 | 10 | Y | N | N | Y | ‘DISTANCE 100 m’与‘JARS 5/6’文字间距过小，易误读为‘100m JARS’；发光罐子无明确交互提示（如闪烁/高亮边框），新手可能忽略其可收集性；‘Oasis Noon’标题字体略小且居中偏上，与背景融合度高，远距离辨识度稍弱 |
| tests/final/06-night.png | 7 | 8 | 9 | Y | N | N | Y | ‘Star Night’标题与背景星点融合度高，弱对比下可能不易辨识；距离180m与JARS 4/6数值字体偏小，远距阅读略吃力；发光罐子目标虽亮但无明确交互提示（如闪烁/箭头），新手可能忽略 |
| tests/final/07-result.png | 9 | 7 | 10 | Y | N | N | Y | ‘Silk Dawn’作为文本值未加引号或标签，易与字段名混淆（Farthest leg行）；‘Press R to run again’提示字号过小，对比度偏低，弱光下可能难辨；背景模糊导致整体景深过浅，部分玩家可能误判界面层级 |
| tests/final/08-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 玩家角色与前方罐子距离过近，易误判交互范围；黑色深渊边缘无警示标识，新手可能误入；‘Silk Dawn’标题字体颜色与背景对比度偏低（#8B6F4E on #F5D3A0） |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

