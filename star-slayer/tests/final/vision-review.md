# 截图自动评审 — star-slayer

> 7 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.3 / silhouette 7.3 / style 8.9

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-play.png | 9 | 8 | 9 | Y | N | N | Y | 四个红色敌机血条极短且无数值，难以判断剩余血量；；目标提示框‘ELIMINATE ALL HOSTILES’未与玩家位置对齐，视觉重心偏上；；网格背景略显干扰，可能影响低对比度敌人辨识（如暗红敌机） |
| tests/final/02-boss.png | 8 | 9 | 9 | Y | N | N | Y | 目标提示框‘ELIMINATE ALL HOSTILES’无背景底色，深蓝背景下对比度略低（尤其在低亮度屏）；左上角‘Core Behemoth’文字颜色偏淡，与血条重叠区域易误读；两个红色敌方单位上方的红色短线状态条过短，难以辨识当前状态 |
| tests/final/03-overload-ready.png | 8 | 7 | 9 | Y | N | N | Y | 中央核心目标与两侧敌方箭头图标亮度/光晕相似，眯眼时易混淆主次；顶部‘Core Behemoth’文字颜色过浅（淡黄），在深蓝背景上对比度偏低；‘OVERLOAD READY’按钮无明确交互反馈提示（如边框/阴影），可能被误认为静态标签 |
| tests/final/04-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 敌人三角形与血条（红色短线）间距过小，易误判为单一元素；中央目标提示‘ELIMINATE ALL HOSTILES’无背景板，深色网格上对比度偏低；右下按钮组（FIRE/OVER/SYNC）垂直排列紧凑，移动端可能误触 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 9 | Y | N | N | Y | 目标提示框‘ELIMINATE ALL HOSTILES’无明确指向性，未关联敌方位置；右下角红色箭头指示器模糊且无标签，功能不明；玩家飞船下方小圆点疑似拖尾/锁定点，但视觉权重过低易被忽略 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 目标提示框（ELIMINATE ALL HOSTILES）无明确指向性，未连接到实际敌人位置；红色玩家箭头与底部 HUD 按钮区域过近，可能误触；‘FIRST SORTIE’提示框字体大小与主目标框不一致，层级感弱 |
| tests/final/tutorial-replay.png | 9 | 6 | 8 | Y | N | N | Y | 标题 'STAR SLAYER' 发光效果过强，导致部分字母边缘模糊（如 'A' 和 'Y'），影响远距离辨识；‘Best wave 0’ 文字颜色偏黄，在深蓝背景上对比度偏低，易被忽略；右上角语言选择下拉框与 'Skip' 按钮间距过小，可能误触 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

