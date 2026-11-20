# 截图自动评审 — marry-rich

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.6 / silhouette 7.0 / style 8.9

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 6 | 8 | Y | N | N | Y | 背景人物剪影模糊且与标题文字亮度接近，眯眼时难以区分角色与环境；‘Endings found 0/8’文字颜色偏黄，在深紫背景下对比度略低，小字号易被忽略；右上角语言选择下拉框无展开指示（如三角图标），交互意图不明确 |
| tests/final/02-title-zh.png | 9 | 6 | 8 | Y | N | N | Y | 背景人物剪影模糊，无法明确区分角色与环境（silhouette偏低）；右上角语言切换下拉框无展开箭头，交互意图不明显；‘已解锁结局 0/8’文字偏小且颜色对比度略低，弱光环境下可能难辨 |
| tests/final/03-tutorial.png | 8 | 9 | 9 | Y | N | N | Y | 左上角‘Hometown’标签背景色与文字对比度偏低，夜间模式下略难辨识；‘FIRST STEPS’提示框位于角色下方偏右，与选项按钮间距不均，视觉重心稍偏；右上角‘Skip’按钮无悬停反馈提示，可能被误认为装饰元素 |
| tests/final/04-play.png | 9 | 8 | 10 | Y | N | N | Y | 左上角HUD中'Hometown'标签背景色与文字对比度偏低，弱光下可能难辨；角色剪影左手持物（疑似票/手机）细节模糊，易误判为手臂姿势；右上月亮与章节框轻微重叠，虽未遮文字但视觉干扰轻微 |
| tests/final/05-result.png | 8 | 9 | 10 | Y | N | N | Y | 左上角HUD中'Hometown'标签背景色与文字对比度偏低，夜间模式下可能辨识困难；‘Chapter 1/12’位置偏上且字号小，易被忽略；右上月亮与右侧平衡杆式UI元素视觉权重接近，可能分散对核心提示框的注意力 |
| tests/final/06-paused.png | 9 | 5 | 8 | Y | N | N | Y | 背景人物剪影模糊且与城市轮廓融合，眯眼时难以区分玩家角色与环境（silhouette偏低）；‘Paused’标题与按钮间距偏大，视觉重心略松散；右上角语言切换下拉框无展开指示图标，移动端可能误触 |
| tests/final/07-ending.png | 9 | 4 | 8 | Y | N | N | Y | 背景模糊角色剪影过暗且轮廓不清，眯眼时无法辨识玩家/敌人（silhouette低）；‘Endings discovered 1/8’与下方提示文字间距过小，易误读为一行；‘Memory shard unlocked — replay the road not taken.’使用破折号但前后空格不一致，排版略粗糙 |
| tests/final/08-mobile-play.png | 8 | 9 | 10 | Y | N | N | Y | 左上角‘Hometown’标签被部分遮挡（与上方条目重叠）；‘Mento 0 Partner 0 Reputation 0’文字过小且颜色浅，易忽略；章节标题‘CHAPTER 1/12’重复出现两次，冗余 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

