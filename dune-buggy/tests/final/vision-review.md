# 截图自动评审 — dune-buggy

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.5 / silhouette 7.6 / style 9.5

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-play.png | 9 | 8 | 10 | Y | N | N | Y | 目标时间22s与当前4.0s对比不明显，进度条过短易误判；右上角' BEST — s'中破折号后空格异常，疑似占位符未替换；车辆阴影过小且位置偏左，与车体对齐略偏差 |
| tests/final/02-ridge.png | 8 | 9 | 10 | Y | N | N | Y | 左上角 'STAGE 2 Golden Ridge' 中 '2' 与 'Golden Ridge' 间距过小，易误读为 'Stage2GoldenRidge'；右上角 'TIRES High' 的 'High' 无单位或状态说明，语义模糊；目标时间 'TARGET 26 s' 与当前时间 'TIME 2.8 s' 未用颜色区分紧迫性（如红/绿），影响快速判断 |
| tests/final/03-jump.png | 8 | 7 | 9 | Y | N | N | Y | 目标时间34s与当前14.9s对比不直观，建议用进度条+百分比强化感知；‘Oasis Jump’文字较小且无强调，易被忽略（左上角）；远处终点门结构细节模糊，眯眼时难以确认为可交互目标 |
| tests/final/04-rock.png | 9 | 8 | 10 | Y | N | N | Y | 目标时间 '30 s' 与当前时间 '8.0 s' 间距过小，易误读为 '30.8 s'；右上角 'TIRES High' 文字字号略小于其他 HUD 元素，轻微不一致；远处拱门内 'FINISH' 文字过小且无对比色，在远距离可能辨识困难 |
| tests/final/05-storm.png | 8 | 9 | 10 | Y | N | N | Y | 左上角 'TIME 3.9 s' 与 'TARGET 56 s' 间距过小，易误读为同一行；中央提示 'On the ridge!' 字体过小且无对比色，在渐变背景中辨识度偏低；右上角 'TIRES High' 与 'BEST 16.7 s' 垂直排列紧凑，小屏可能误触 |
| tests/final/06-dusk.png | 9 | 8 | 10 | Y | N | N | Y | ‘On the ridge!’提示文字位置偏上且字号小，易被忽略；左上角进度条与STAGE/TIME/TARGET标签间距过紧，视觉拥挤；车体下方小鸡状物体语义不明，可能干扰玩家对核心交互对象判断 |
| tests/final/07-mobile.png | 8 | 7 | 9 | Y | N | N | Y | 左下角左右箭头按钮间距过小，易误触；；‘BEST — s’中破折号与单位‘s’间无空格，排版不规范；；远处目标点（红色小车）太小且缺乏高对比标识，远距离辨识度低 |
| tests/final/08-title.png | 9 | 5 | 8 | Y | N | N | Y | 标题‘DUNE BUGGY’发光效果过强，导致部分字母边缘模糊，影响远距离辨识；‘Baja rally: ride the golden ridge...’副标题字号偏小，在低分辨率下易被忽略；右上角语言选择下拉框无展开箭头图标，交互意图不明确 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

