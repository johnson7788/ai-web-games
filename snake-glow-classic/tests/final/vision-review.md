# 截图自动评审 — snake-glow-classic

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.1 / silhouette 6.5 / style 8.4

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 5 | 8 | Y | N | N | Y | ‘SNAKE GLOW CLASSIC’标题与副标题‘NEON ARCADE · 120s CLASSIC RUN’颜色风格不一致（青蓝 vs 紫粉），削弱统一感；‘How to play’按钮边框过细且无悬停反馈，移动端易误触或难识别；右上角语言选择下拉框无展开箭头图标，交互意图模糊 |
| tests/final/02-title-zh.png | 9 | 7 | 8 | Y | N | N | Y | 标题‘霓虹贪吃蛇’与副标题‘霓虹街机 · 120 秒经典局’颜色对比弱（青蓝+粉紫），在低对比度环境下可能辨识困难；‘玩法说明’按钮无悬停/选中反馈，交互状态不明确；右上角语言切换下拉框边框过细且无箭头图标，易被忽略 |
| tests/final/03-playing.png | 6 | 7 | 8 | Y | N | N | Y | 中央进度条与星星目标紧贴，易误触；星星无明确交互反馈提示；顶部‘STAGE 1 · ORBS’文字使用双色渐变（紫/粉），与整体冷色调UI略冲突；网格背景过细且亮度低，导致中央对象对比度不足，影响快速定位 |
| tests/final/04-rocks.png | 8 | 9 | 10 | Y | N | N | Y | 右上角星形目标与最近紫色菱形距离过近，可能误判为同一物体；中间偏右有模糊绿色粒子群，疑似残留特效或未清除对象，位置在路径中；‘STAGE 2 · ROCKS’文字使用粉紫渐变，与整体霓虹蓝紫风格略冲突，但可接受 |
| tests/final/05-result-win.png | 8 | 6 | 9 | Y | N | N | Y | 三颗星评分与‘Score 0’‘Length 4’等文字垂直居中偏上，视觉重心不稳；背景紫色菱形碎片部分遮挡左上角星形图标（可能为收藏/成就），影响可识别性；‘TIME UP — YOU SURVIVED’使用破折号而非标准en dash，排版细节不严谨 |
| tests/final/06-result-stars.png | 9 | 6 | 8 | Y | N | N | Y | 三颗星图标与'Score 1200'之间间距过小，视觉拥挤；左上角HUD信息（Score 0, Length 4等）颜色过淡、对比度低，易被忽略；‘NEW BEST’文字为黄色小字，未加粗/无背景，易被误读或忽略 |
| tests/final/07-m-title.png | 9 | 6 | 8 | Y | N | N | Y | 标题 'SNAKE GLOW CLASSIC' 与副标题 'NEON ARCADE · 120s CLASSIC RUN' 颜色不一致（青蓝 vs 紫粉），轻微风格割裂；‘How to play’按钮无背景填充，仅边框+文字，在深色背景下对比度偏低，易被忽略；右上角语言选择器‘English’下拉箭头过小且无 hover 反馈，移动端操作风险 |
| tests/final/08-m-play.png | 7 | 6 | 8 | Y | N | N | Y | 玩家主体（彩色条）与数字'8'融合，数字易被误认为装饰而非状态值；网格背景过暗且无对比度，导致小目标（如星星）边缘辨识度低；顶部HUD中'STAGE 1 · ORBS'文字颜色与背景对比不足，弱光下可能难读 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

