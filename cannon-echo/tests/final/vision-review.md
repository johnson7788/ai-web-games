# 截图自动评审 — cannon-echo

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.9 / silhouette 6.9 / style 8.5

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 背景模糊元素（如左上角光斑、右上红方块）与主标题亮度接近，可能干扰视觉焦点；‘Best score 0’文字颜色偏黄，在深绿背景下对比度略低，影响快速识别；标题‘CANNON ECHO’发光效果过强，导致部分字母边缘轻微晕染，影响远距离辨识 |
| tests/final/02-title-zh.png | 9 | 6 | 8 | Y | N | N | Y | 背景模糊元素（左上黄块、右上红块）轮廓不清，可能干扰目标识别；‘最高分 0’字号偏小且颜色较浅，易被忽略；标题‘CANNON ECHO’发光效果过强，部分字母边缘轻微光晕溢出 |
| tests/final/03-play.png | 7 | 8 | 9 | Y | N | N | Y | 左上角‘SCORE 0’‘WAVE 1’‘CANNON 1’标签文字过小，3秒内需细看才能辨识；顶部‘Morning Valley’标题无背景衬底，与深绿背景对比度偏低；四个标‘40’的方块无明确敌我标识，易误判为可拾取物 |
| tests/final/04-combat.png | 7 | 8 | 9 | Y | N | N | Y | 左上角‘WAVE 1’与‘CANNON 1’按钮间距过小，易误触；‘Morning Valley’标题无背景衬底，在深绿背景下对比度偏低；炮台图标中心白点过小，缩放后可能难以精确定位 |
| tests/final/05-echo.png | 7 | 8 | 9 | Y | N | N | Y | 左上角HUD（SCORE/WAVE/CANNON）与左侧边框间距过小，可能在窄屏被裁切；‘Morning Valley’标题无背景衬底，深绿背景下部分文字对比度偏低；炮弹轨迹小蓝点（白色圆点+短线）辨识度低，易与背景混淆 |
| tests/final/06-upgrade.png | 9 | 6 | 8 | Y | N | N | Y | 背景模糊导致玩家角色轮廓不清晰（silhouette偏低）；标题文字‘Choose an upgrade’为金色，与深绿背景对比度略低，弱光下可能难辨；三个按钮间距紧凑，无明显视觉层级区分优先级 |
| tests/final/07-boss.png | 7 | 6 | 8 | Y | N | N | Y | 中央紫色方块‘1740’数字与小黄点重叠，可能误判为敌人或特效；‘The Great Crate’进度条过细且颜色对比弱，易被忽略；左上角HUD标签（SCORE/WAVE/CANNON）字体偏小，远距离辨识度低 |
| tests/final/08-mobile.png | 8 | 7 | 9 | Y | N | N | Y | ‘Morning Valley’标题与上方敌人数值框轻微重叠（Y轴对齐不一致）；左上角‘WAVE 1’和‘CANNON 1’按钮间距过小，易误触；右上角HEAT条无数值标注，无法判断当前值 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

