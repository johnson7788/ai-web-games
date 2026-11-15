# 截图自动评审 — rocket-derby

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 6.2 / style 8.2

**结论：FAIL**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 7 | 6 | 8 | Y | N | N | Y | 玩家单位（左）与敌方单位（右）颜色对比弱，眯眼时易混淆；红色敌人偏暗，棕色玩家无高亮轮廓；中央绿圈（开球区）与地面网格线颜色接近，边界不够突出；左下BOOST条无文字标签，仅靠颜色推断功能，新手可能困惑 |
| tests/final/mobile.png | 9 | 7 | 8 | Y | N | N | Y | 玩家小车在中心圆圈内，但圆圈为细绿线，与背景网格线对比度低，远距离辨识度弱；‘FASTEST GOAL’和‘WINS’数值框字体偏小，且与背景纹理融合稍强，弱光下可能难读；标题‘ROCKET DERBY’发光效果过强，轻微溢光导致边缘文字略糊（尤其‘Y’） |
| tests/final/tutorial-after-skip.png | 7 | 6 | 8 | N | N | N | Y | ‘KICK OFF’文字悬浮于场地中央但无明确交互提示，玩家可能不确定是否需点击；红/黑角色轮廓对比度低，眯眼时难以快速区分敌我（尤其左侧两个深色单位）；左下角BOOST条无标签，功能不直观；且绿色条与场地边缘发光带颜色近似易混淆 |
| tests/final/tutorial-first.png | 8 | 7 | 9 | Y | N | N | Y | 右下角提示框遮挡部分场地边缘，可能影响新手对边界判断；‘KICK OFF’文字为浅黄，在深蓝背景上对比度偏低，弱光下易误读；球员模型过小且颜色与场地纹理接近（红/暗色），远距离辨识度不足 |
| tests/final/tutorial-replay.png | 9 | 5 | 8 | Y | N | N | Y | 窗口顶部三颗状态点中仅第一颗亮起，但无说明其含义，易引发困惑；‘Drive with W/S and steer with A/D’未明确区分移动/转向轴，新手可能混淆；整体为桌面UI风格，若用于移动端需重新适配按钮尺寸与间距 |

## Critical（必须修）

- tests/final/tutorial-after-skip.png: 目标不可见

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

