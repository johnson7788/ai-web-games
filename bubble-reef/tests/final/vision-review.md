# 截图自动评审 — bubble-reef

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.6 / silhouette 7.1 / style 9.0

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 底部海草剪影与主按钮区域无明确分隔，可能干扰视觉焦点；‘Best 0’字号过小且颜色偏淡，易被忽略；标题‘BUBBLE REEF’发光效果略过强，导致部分字母边缘轻微晕染 |
| tests/final/01-tutorial.png | 8 | 7 | 9 | Y | N | N | Y | Level 1 文字与气泡重叠，部分字母被遮挡（如 'L' 和 'e'）；‘Clear 70% of the reef’提示文字颜色过淡，对比度不足；底部操作提示框与炮台位置接近，可能误触 |
| tests/final/02-title-zh.png | 9 | 7 | 8 | Y | N | N | Y | 标题‘BUBBLE REEF’发光效果略过强，可能在低对比度设备上影响辨识；底部水草剪影与按钮区域距离过近，视觉上略显拥挤；‘最佳 0’文字字号偏小，弱光环境下易被忽略 |
| tests/final/03-play.png | 9 | 8 | 10 | Y | N | N | Y | 底部‘P to preview · 1’提示框右下角轻微超出安全边（但为桌面截图，不影响评分）；气球阵列底部悬垂的单个绿色气球与主阵列连接线较细，可能被误认为非目标；Combo 0 和 Score 0 字体偏小，在低分辨率下可能辨识度下降 |
| tests/final/04-paused.png | 8 | 7 | 9 | Y | N | N | Y | ‘Paused’文字与背景气球阵列对比度偏低，弱光下可能不易辨识；底部玩家小球被虚线和暂停UI部分遮挡，影响操作预期感知；语言切换下拉框无展开箭头图标，交互意图不明确 |
| tests/final/05-dead.png | 8 | 6 | 9 | Y | N | N | Y | 背景气球阵列与HUD文字存在轻微视觉干扰，眯眼时气球颜色相近导致层级辨识度低；‘Press R to play again’提示字号过小且灰度高，易被忽略；‘Reached level’数值‘1’为黄色，与‘Score’/‘Best score’的白色不一致，轻微风格断裂 |
| tests/final/06-mobile-play.png | 9 | 8 | 9 | Y | N | N | Y | 顶部进度条左侧填充色与背景对比度偏低，可能影响低亮度下辨识；右下角'P to preview · 1'按钮文字与边框间距过小，移动端易误触；泡泡阵列中部分黄色/粉色泡泡在密集处边界模糊，轻微粘连感 |
| tests/final/tutorial-after-skip.png | 9 | 8 | 10 | Y | N | N | Y | Level 1 目标提示框轻微遮挡上方气泡阵列顶部一行（约1-2个气泡）；底部虚线引导线与发射器对齐但未明确标注‘发射线’，新手可能忽略；右下角‘P to preview · 1’按钮文字偏小（约10px），在低分辨率屏可能难读 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

