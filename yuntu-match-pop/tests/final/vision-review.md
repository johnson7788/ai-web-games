# 截图自动评审 — yuntu-match-pop

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.5 / silhouette 7.3 / style 8.8

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 8 | 9 | Y | N | N | Y | 目标值 '32' 的黄色背景与下方同值方块颜色冲突，易混淆（目标区 vs 游戏区）；‘TARGET’标签字体较小且无高对比度，弱光下可能难辨；右上角语言切换按钮无悬停反馈，且下拉箭头过小 |
| tests/final/02-playing.png | 8 | 7 | 9 | Y | N | N | Y | 目标数字32与'COMBO x2'文字部分重叠，影响目标识别清晰度；底部提示文字'Tap a column to drop the block'在深色背景上对比度偏低，易被忽略；右上角图标（炸弹、工具等）尺寸过小且无文字标签，功能不明确 |
| tests/final/03-merge.png | 9 | 7 | 8 | Y | N | N | Y | 弹窗遮挡下方游戏区域（32和16方块部分被覆盖），影响后续操作预判；‘Target Reached!’弹窗无关闭X按钮，仅靠三个功能按钮退出，不符合标准模态框设计；顶部HUD中‘TARGET 32’与‘NEXT 2’间距过近，视觉上易误读为同一组信息 |
| tests/final/04-rock.png | 8 | 7 | 9 | Y | N | N | Y | 底部提示文字'Tap a column to drop the block'在深色背景上对比度偏低，弱光下可能难读；中间灰色Y形图标语义不明，未标注功能（疑似特殊操作键）；顶部'NEXT 4'与右侧图标间距过密，视觉拥挤 |
| tests/final/05-combo.png | 9 | 8 | 9 | Y | N | N | Y | ‘COMBO x2’文字部分被顶部HUD遮挡（位于TARGET下方）；‘Tap a column to drop the block’提示文字过小且颜色对比度偏低，弱光环境下可能难辨；右上角图标组间距紧凑，部分图标（如问号、重置）在小屏设备上易误触 |
| tests/final/06-result.png | 9 | 7 | 8 | Y | N | N | Y | 弹窗中‘Combo x3’字体略小且与上方星星间距过近，易误读为‘Combo x32’；背景网格块在弹窗后仍可见但模糊，可能干扰焦点；顶部‘TARGET 32’与弹窗标题‘Target Reached!’语义重复，轻微冗余 |
| tests/final/07-zh.png | 8 | 7 | 9 | Y | N | N | Y | 目标数字'32'下方有模糊黄色文字（疑似'达成'），但被遮挡不清晰，影响目标理解；底部提示'点一列放下方块'字体偏小且颜色对比度不足（浅灰底+白字），在深色背景下易忽略；右上角功能图标（炸弹、工具等）无文字说明，新手可能不知用途 |
| tests/final/08-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 目标数字'32'与'TARGET'文字部分重叠，且'32'背景色块边缘有轻微溢出；底部提示文字'Tap a column to drop the block'被最左列方块轻微遮挡（y轴偏移不足）；炸弹图标按钮外发光边框与相邻音量按钮间距过小，视觉拥挤 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

