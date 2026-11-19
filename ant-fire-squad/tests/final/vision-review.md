# 截图自动评审 — ant-fire-squad

> 4 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.5 / silhouette 7.3 / style 9.0

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-playing.png | 7 | 8 | 9 | Y | N | N | Y | ‘Tap to drop embers’提示文字位置偏上，与HUD按钮区接近，可能被误认为UI元素而非操作指引；三只橙色敌人尺寸过小且无明显轮廓高亮，在深蓝网格背景下辨识度略低；Heat 0/60数值为白色，与深蓝背景对比度不足，弱光环境下可能难读 |
| tests/final/02-combo.png | 8 | 7 | 9 | Y | N | N | Y | 顶部HUD中'x3'倍率标识与'Squad 3/3'按钮间距过小，易误触；中部提示文字'Tap to drop embers'无背景衬底，在深色网格背景下对比度偏低；右上角四个功能图标大小不一、间距不均，风格略显杂乱 |
| tests/final/03-wasp.png | 7 | 8 | 9 | Y | N | N | Y | ‘Tap to drop embers’提示悬浮于画面中上部，无明确指向目标，易误判为全局提示而非局部交互引导；左上角‘Heat 24/60’进度条文字与背景对比度偏低（橙黄渐变底+白字），弱光环境下可能难辨；右上角图标按钮（?、手形、重试、主页）尺寸偏小且间距紧凑，桌面截图虽不扣分，但暗示移动端适配风险 |
| tests/final/04-result.png | 8 | 6 | 9 | Y | N | N | Y | 底部中央圆形光效与‘Retry’/‘Next Level’按钮视觉距离过近，可能误触；左下角紫色小敌人轮廓模糊，与背景对比度低，silhouette得分偏低；顶部‘Tap to drop embers’提示文字颜色偏淡（灰白），在深色背景下辨识度不足 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

