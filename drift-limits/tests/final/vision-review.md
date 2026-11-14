# 截图自动评审 — drift-limits

> 4 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.5 / silhouette 7.0 / style 8.5

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 7 | 8 | Y | N | N | Y | ‘BEST 0’中‘0’字号过小且无单位，易被忽略；右侧赛车部分被HUD右边缘轻微遮挡（车尾与‘ARROW’按钮同高）；‘GARAGE PERKS — pick 2’标题与下方选项间距不均，视觉层级弱 |
| tests/final/03-drift.png | 8 | 7 | 9 | Y | N | N | Y | 速度显示‘125 KM/H’字体偏小且无背景衬底，在暗路面易误读；Nitro/Police条下方‘34m’单位与主UI风格不一致（其他用‘x1’‘LAP 1/3’等）；车尾拖影过强导致车身轮廓模糊，影响高速时目标辨识 |
| tests/final/06-results.png | 9 | 7 | 8 | Y | N | N | Y | ‘NEW RECORD!’文字为黄色，与主色调（青蓝）冲突，易被误读为警告而非成就提示；‘RANK C’中字母C尺寸过大且无明确层级关系，略显突兀；背景城市建筑细节过密，夜间场景下部分窗户光点干扰视觉焦点 |
| tests/final/mobile-game.png | 8 | 7 | 9 | Y | N | N | Y | 左下速度180 KM/H单位‘KM/H’字体略小且与数字间距紧，易误读为180K；右上LAP 1/3与HEAT 1同行但对齐不一致，HEAT右侧有空隙；交通灯红灯亮起但无明确‘等待’提示，新手可能忽略起跑信号 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

