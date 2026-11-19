# 截图自动评审 — escape-battle-run

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.9 / silhouette 7.1 / style 8.6

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 5 | 8 | Y | N | N | Y | 标题‘ESCAPE BATTLE RUN’无明确玩家/敌人视觉锚点，眯眼时难以区分核心交互元素；‘Best: 0’颜色（黄）与主标题（青）对比弱，易被忽略；右上角语言选择框边框过细且无悬停反馈，移动端可能误触 |
| tests/final/01b-title-zh.png | 9 | 5 | 8 | Y | N | N | Y | 标题‘逃生大作战’与副标题间距过小，略显拥挤；‘最佳：0’字号偏小且颜色较淡，易被忽略；右上角语言选择框无下拉箭头图标，交互意图不明确 |
| tests/final/02-playing.png | 7 | 8 | 9 | Y | N | N | Y | 顶部 'grab ! dodge' 提示文字与左侧按钮间距过小，视觉拥挤；右上角 'Nova Burst' 和 'How to play' 按钮无明确状态反馈（如悬停/选中）；能量条标签 'Energy' 与进度条间距过近，易误读为整体组件 |
| tests/final/03-result.png | 9 | 6 | 8 | Y | N | N | Y |  Rating 星星中第三颗为灰色空心，与‘Escape Failed’标题的失败语境冲突，易引发歧义；背景中模糊红点（疑似敌人/障碍）在深蓝底上对比度低，眯眼时难以辨识轮廓；‘New best!’提示文字颜色偏淡（浅青），在深色背景下可读性略弱 |
| tests/final/07-m-playing.png | 7 | 8 | 9 | Y | N | N | Y | 左上角'W1'与空椭圆按钮间距过小，易误触；右上'How to play'按钮文字略显紧凑，小屏可能阅读吃力；红色敌人顶部感叹号图标微小且无对比度，远距离难辨识 |
| tests/final/tutorial-after-skip.png | 8 | 9 | 9 | Y | N | N | Y | 顶部 'grab ! dodge' 提示文字无背景，暗色背景下对比度偏低，可能影响弱光环境可读性；能量条标签 'Energy' 与进度条间距过小，易误读为整体组件；右上角按钮组（Nova Burst / How to play / ? / ▲）横向紧凑，小屏可能误触 |
| tests/final/tutorial-first.png | 7 | 8 | 9 | Y | N | N | Y | 教程弹窗遮挡中央玩家角色，影响初始操作感知；左上角‘8’与‘W1’按钮间距过小，视觉拥挤；红色无人机顶部感叹号图标微小且无明确交互提示 |
| tests/final/tutorial-replay.png | 7 | 8 | 9 | Y | N | N | Y | 教程弹窗遮挡中央玩家角色，影响初始操作视野；左上角‘8’‘W1’‘Best 0’等HUD元素间距过密，易误触；右上‘Nova Burst’与‘How to play’按钮文字颜色相近，对比度偏低 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

