# 截图自动评审 — saucer-strike

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 6.3 / style 8.5

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 5 | 8 | Y | N | N | Y | 标题‘SAUCER STRIKE’发光效果过强，导致部分字母边缘模糊，影响远距离辨识；‘Best 0’文字字号偏小且颜色较淡，易被忽略；右上角语言切换按钮无悬停反馈，且下拉箭头与背景对比度低 |
| tests/final/03-tutorial.png | 8 | 7 | 9 | Y | N | N | Y | 右下角 UFO 目标被取景框（L型角标）部分遮挡，影响目标识别；‘WAVE 1’下方三点加载指示器过小且无动画，易被忽略；提示框‘Drag to aim the railgun’未说明拖动方向/范围，新手可能误操作 |
| tests/final/04-play.png | 8 | 7 | 9 | Y | N | N | Y | 右上角两个目标标记（带方框的圆）位置偏高且靠近边缘，可能被状态栏遮挡（桌面截图中未遮但移动端风险高）；‘WAVE 1’下方三点加载指示器无明确语义，新手可能误以为是敌人或可交互物；底部发射器与地面交界处阴影较弱，玩家轮廓在深棕背景中对比度略不足 |
| tests/final/06-dead.png | 9 | 5 | 8 | Y | N | N | Y | ‘RADAR LOST’标题与下方字段间距过小，视觉层级略显拥挤；‘Rating: C’未说明评级标准，可能引起困惑；整体界面无角色/敌人 silhouette 可辨，因是结算界面而非游戏进行中画面 |
| tests/final/07-restart.png | 7 | 6 | 8 | Y | N | N | Y | 敌人目标（右上/左下）与瞄准框重叠，但目标本身无明显动作或状态指示，易误判是否已锁定；‘WAVE 1’下方三点加载动画过小且无说明，新手可能不知是等待中；底部发射器与地面阴影融合，轮廓不够突出，影响 silhouette 得分 |
| tests/final/08-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 顶部 'Skip' 按钮与左上角 HUD 元素间距过小，可能误触；‘FIRST CONTACT’提示框背景半透明但与深色背景对比度偏低，弱光下可读性下降；两个目标图标外框为黄色方框+圆点，视觉层级略弱于中央提示框，新手可能忽略目标 |
| tests/final/tutorial-after-skip.png | 7 | 6 | 8 | Y | N | N | Y | 玩家控制器（底部圆环）与地面边缘融合，轮廓不清晰，影响 silhouette；右下角雷达图标部分被屏幕边缘裁切（仅显示左半），疑似 text_clipped 或 layout 问题；‘WAVE 1’下方三点动画无明确语义，新手可能不解其作用 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 右上角 UFO 目标被黄色取景框部分遮挡，可能影响精确瞄准；底部提示框‘Drag to aim the railgun’与 railgun 操作区重叠，新手易误触提示框而非操作区；‘WAVE 1’下方三点加载指示器无明确语义，可能被误认为可交互元素 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

