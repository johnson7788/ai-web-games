# 截图自动评审 — ragdoll-archers-3d

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.4 / silhouette 6.6 / style 7.4

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 8 | 6 | 7 | Y | N | N | Y | 玩家角色（蓝色小人）在背景中偏暗且尺寸小，眯眼时与地面纹理混淆，silhouette得分偏低；标题‘RAGDOLL ARCHERS 3D’字体较细，在昏黄背景下对比度不足，影响快速阅读；左上角石柱结构模糊、无明确功能指示,易被误认为装饰而非可交互物 |
| tests/final/mobile.png | 9 | 6 | 7 | Y | N | N | Y | 背景中蓝色小人（玩家）轮廓模糊、对比度低，眯眼时难以与环境区分；左下角两个圆形虚拟按键无明确功能标识，且未说明是否为移动/射击控制；‘Best: 0s · Headshots: 0’文字偏小，距按钮过近，易被误读为按钮一部分 |
| tests/final/tutorial-after-skip.png | 8 | 7 | 6 | Y | N | N | Y | 敌人标签‘ENEMY’红色边框与背景沙地对比度偏低，远距离辨识稍弱；玩家角色头顶‘YOU’标签箭头指向错误（应指向下而非上）；整体风格偏低多边形但光影不统一：角色有阴影而地面无明显光照方向 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 玩家角色头顶‘YOU’标签箭头指向错误（应指角色本体而非标签框）；敌人标签‘ENEMY’红色三角指示器方向与角色朝向不一致，易误导；教程弹窗遮挡部分地面纹理，轻微影响空间判断 |
| tests/final/tutorial-replay.png | 9 | 7 | 8 | Y | N | N | Y | 教程提示框（1/4）位于屏幕底部中央，与主菜单按钮区域重叠风险高，可能干扰操作；背景中左右两侧角色轮廓较模糊，眯眼时与环境对比度不足，影响 silhouette 得分；‘Best: 0s · Headshots: 0’文字字号偏小，弱光环境下易误读 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

