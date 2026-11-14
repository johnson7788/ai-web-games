# 截图自动评审 — front-wars

> 7 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.7 / silhouette 7.0 / style 8.3

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop-title.png | 9 | 6 | 8 | Y | N | N | Y | 背景模糊元素（左/右两侧）可能干扰焦点，但未遮挡主界面；‘How to play’按钮文字颜色较暗，对比度偏低，易被忽略；右下角图标疑似UI残留或占位符，风格与主界面不一致 |
| tests/final/desktop-loadout.png | 9 | 7 | 8 | Y | N | N | Y | SCOUT卡片中'Fast and quick-firing, but fragile.'描述文字行距略紧，小屏可能阅读吃力；HP/SPEED/DMG数值字体偏小（约10px），在低分辨率下易混淆；‘SELECT LOADOUT’标题颜色过浅（#4A90E2），与深背景对比度不足（仅3.2:1），部分色弱用户难辨 |
| tests/final/desktop-playing.png | 8 | 7 | 9 | Y | N | N | Y | B2/B3/B4与左侧掩体重叠，角色轮廓被部分遮挡，影响辨识；R1/R2/R3/R4敌人标识（红圈+白点）与掩体边缘紧贴，易误判位置；左下角‘RIFLEMAN’标签与HP条间距过小，视觉拥挤 |
| tests/final/desktop-round.png | 9 | 7 | 8 | Y | N | N | Y | ‘ROUND WON’下方小字‘One pick carries into the next round.’字号偏小，弱光环境下可能难辨；装备图标与文字间距紧凑，移动端易误触；背景模糊区域隐约可见左侧UI元素轮廓，存在轻微视觉干扰 |
| tests/final/desktop-end.png | 9 | 7 | 8 | Y | N | N | Y | ‘KILLS’和‘DEATHS’数值为0，但胜利比分2-0，逻辑上可能引发疑问（非UI缺陷，但需确认游戏规则）；‘The line held. Your squad takes the sector.’文字字号偏小，弱光环境下可读性略降；背景模糊元素含疑似图标/指示器，但因虚化无法辨识是否与HUD冲突，保守视为潜在干扰 |
| tests/final/tutorial-first.png | 9 | 8 | 8 | Y | N | N | Y | 教程提示框底部进度条黄色部分与背景网格线颜色接近，弱对比度易忽略；右上角暂停按钮与设置图标间距过小，可能误触（桌面截图但需考虑响应式）；‘MOVE’虚线圈为黄色，与目标红靶心色系冲突，视觉优先级略混乱 |
| tests/final/mobile-playing.png | 8 | 7 | 9 | Y | N | N | Y | R1/R2/R3/R4敌人图标与平台边缘紧贴，可能误触或视觉混淆；右下角DASH与AIM/FIRE按钮间距过小，易误操作；中央'ROUND 1 DEPOT'文字无背景衬底，在深色网格上对比度略低 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

