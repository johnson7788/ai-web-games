# 截图自动评审 — blaze-fps

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.4 / silhouette 5.4 / style 8.2

**结论：FAIL**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 3 | 4 | 7 | N | N | N | Y | 目标不可见：Wave 1 无敌人出现，玩家无法判断行动方向；视野过暗：主体区域几乎全黑，仅枪械与准星可见；HP/STAMINA数值与条形图对比度低，64值在红条末端不易辨识 |
| tests/final/mobile.png | 9 | 6 | 8 | Y | N | N | Y | 背景中多个低多边形物体（如红/黄/棕锥体）轮廓模糊，眯眼时难以区分功能（敌方？道具？障碍？）；‘BEST 0’中数字‘0’字号略小且无高亮，与标题对比度不足，易被忽略；右上角语言切换与Mute按钮间距过近，可能误触（虽为桌面截图，但UI布局风险存在） |
| tests/final/tutorial-after-skip.png | 8 | 6 | 9 | Y | N | N | Y | 倒计时数字'2'与'GET READY'间距过小，易误读为'2 GET READY'；枪械模型在暗背景下轮廓模糊，与背景对比度不足，影响silhouette得分；左上角'WAREHOUSE'按钮无悬停/选中态视觉反馈，可能被误认为静态标签 |
| tests/final/tutorial-first.png | 8 | 6 | 9 | Y | Y | N | Y | 左下角教程面板部分遮挡枪械前部（HUD overlap）；‘Wave 1’倒计时框与枪械瞄准镜区域重叠，可能干扰视线；背景星空与深色地面对比弱，玩家轮廓不突出（silhouette偏低） |
| tests/final/tutorial-replay.png | 9 | 5 | 8 | Y | N | N | Y | 标题'How to play'使用橙色发光字体，但无明确层级区分（如加粗/大小），在深背景上略显浮于表面；进度点（三个小圆点）颜色过暗且尺寸过小，不易察觉当前步骤；‘Skip tutorial’按钮边框与背景对比度低，视觉权重弱于‘Next’，可能误导用户必须点Next |

## Critical（必须修）

- tests/final/desktop.png: 目标不可见
- tests/final/tutorial-first.png: HUD 遮挡

## 低分项

- silhouette 5.4 < 6

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

