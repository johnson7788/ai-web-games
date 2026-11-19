# 截图自动评审 — shepherd-herd

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.9 / silhouette 7.0 / style 8.9

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 3 | 8 | Y | N | N | Y | 标题‘SHEPHERD HERD’与副标题‘Neon shepherd’间距过小，易误读为单行文本；‘0 / 24’与‘Best: 0’使用不同颜色（黄/橙），视觉层级混乱，建议统一色系；无角色/场景预览，眯眼时无法识别任何游戏元素轮廓（silhouette=3主因） |
| tests/final/02-playing.png | 6 | 7 | 9 | Y | N | N | Y | 目标文字 'Feed every sheep once' 与顶部 HUD 按钮间距过小，易误触；底部三蓝点无明确功能提示，玩家难以判断是移动、射击还是选择；左上角 'Feed 0/3' 中 'Feed' 为动词但未加图标，新手可能误解为状态而非任务 |
| tests/final/03-result.png | 9 | 6 | 8 | Y | N | N | Y | ‘COMBO ×3’文字偏小且颜色暗淡，与背景对比度低，易被忽略；底部两个带对勾的圆形图标位置模糊，功能不明（疑似已完成目标标记），缺乏说明；‘10s left’字体过小，与主得分信息层级不匹配，可能被误读为装饰 |
| tests/final/04-golden.png | 8 | 9 | 10 | Y | N | N | Y | 左上角'Feed 0/5'与'16s'间距过小，易误读为'Feed 0/516s'；右上角'How to play'文字垂直居中偏上，与按钮对齐不一致；左侧黄色带星羊轮廓发光过强，可能干扰目标识别（但未遮挡） |
| tests/final/05-rocks.png | 8 | 9 | 10 | Y | N | N | Y | 左上角‘Feed 0/6’右侧按钮无标签，仅空矩形，功能不明；右上角‘How to play’文字与‘0’‘M’‘R’‘H’按钮垂直对齐不一致，视觉松散；底部六颗蓝点指示器无说明，玩家可能误判为生命值或进度 |
| tests/final/06-combo.png | 7 | 8 | 9 | Y | N | N | Y | 顶部 'How to play' 文字与右侧按钮 M/R/H 紧密堆叠，易误触且视觉拥挤；COMBO ×2 字体过大且居中，略压住中间两个带勾图标，轻微干扰目标识别；底部进度条三圆点中仅左点亮起，但无明确指示其为可交互控件，新手可能忽略 |
| tests/final/07-m-title.png | 9 | 6 | 8 | Y | N | N | Y | 标题‘SHEPHERD HERD’与副标题‘Neon shepherd’间距过小，略显拥挤；‘0 / 24’和‘Best: 0’使用黄色字体，在深蓝背景上对比度偏低，易误读；右上角语言选择框无明确选中状态指示（如下拉箭头样式不清晰） |
| tests/final/08-m-playing.png | 7 | 8 | 9 | Y | N | N | Y | ‘How to play’按钮文字垂直居中偏上，与右侧M/R/H按钮基线不齐；目标提示‘Feed every sheep once’为绿色，与背景深紫对比度偏低，弱光下可能难辨；右上角‘0’计数器无单位说明，易误读为时间或分数 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

