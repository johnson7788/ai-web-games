# 截图自动评审 — idle-tycoon-forever

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.8 / silhouette 7.0 / style 8.8

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 8 | 7 | 9 | Y | N | N | Y | 左侧‘YOU’标识与下方HQ Lv1信息间距过小，视觉层级略混乱；部分公司卡片（如Zenith Group）底部进度条颜色与其他不一致（红 vs 绿），风格微冲突；‘Night Market’标题字体与主标题‘IDLE TYCOON FOREVER’风格差异稍大，轻微割裂感 |
| tests/final/02-playing.png | 7 | 8 | 9 | Y | N | N | Y | 左上角资源图标（$3.0K、300、350、10）文字与图标间距过小，易误触；‘YOU’角色下方‘HQ Lv1’标签与角色重叠，视觉层级混乱；部分卡片（如Nova Retail Lv1）右上角感叹号图标与等级文字轻微重叠 |
| tests/final/03-battle.png | 7 | 8 | 9 | Y | N | N | Y | 左上角资源图标间距过小，$3.0K与300菱形易误触；Nova Retail进度条文字'29/40'在紫色条内对比度偏低，弱光下难辨；右侧紫色矩形块标'-11'位置偏右且无明确归属对象，易误解为全局数值 |
| tests/final/04-result.png | 9 | 5 | 8 | Y | N | N | Y | 背景过暗导致‘District Cleared!’标题与背景对比度偏低，弱光环境下可能影响可读性；星星图标与‘Stars’文字间距略紧，视觉上稍显拥挤；‘District 1 · Night Market’字体偏小，在低分辨率屏上可能不易辨识 |
| tests/final/05-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 右下角'Zenith Group Lv5 - BOSS'文字颜色偏红且字号略小，与其余公司卡片风格微异；左侧'YOU'标识与HQ信息垂直排列但间距不均，视觉重心略偏左上；顶部'Night Market'标题字体与主标题风格差异稍明显（手写体 vs 科技感无衬线） |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

