# 截图自动评审 — stickman-escape-room

> 4 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.5 / silhouette 6.0 / style 9.3

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 0 | 10 | Y | N | N | Y | silhouette评分为0：当前为标题页，无角色/敌人/可交互物轮廓，无法评估 silhouette；右上角语言选择框边框与文字颜色对比度偏低（浅青色文字+浅青色边框），在深背景上略难辨识；‘How to play’按钮为描边样式，无填充，视觉权重低于‘Start’按钮，可能被忽略 |
| tests/final/02-play.png | 7 | 8 | 9 | Y | N | N | Y | 顶部‘STAND IN THE GREEN GAP’提示文字偏小且无背景衬底，暗背景下对比度不足；底部平台边缘发光效果与‘EXIT’箭头颜色相近（青绿），易混淆交互意图；角色下方平台无明显高亮或边界线，与空平台视觉区分弱 |
| tests/final/03-descent.png | 7 | 8 | 9 | Y | N | N | Y | 顶部'Room 1'等HUD文字与右侧图标间距过小，易误触；'HOLD!'提示无明确指向对象，新手可能不知需按住什么；底部平台中第4格（玩家脚下）与第9格（右出口）高亮样式相同，易混淆目标 |
| tests/final/04-rock.png | 7 | 8 | 9 | Y | N | N | Y | 顶部‘STAND IN THE GREEN GAP’提示文字偏小且无背景，暗背景下对比度不足；左下角菱形图标与平台边缘重叠，可能误触或干扰路径判断；两个‘EXIT’标签位置对称但无方向指示，易混淆应选哪一侧 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

