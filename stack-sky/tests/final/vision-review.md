# 截图自动评审 — stack-sky

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.8 / silhouette 6.6 / style 9.0

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 8 | 5 | 9 | Y | N | N | Y | 底部堆叠岛屿图形模糊且未对齐中心，难以辨识当前状态或可交互区域；‘Best 0 islands’文字颜色过浅（浅棕），在米黄背景上对比度不足，易被忽略；标题‘STACK SKY’字间距略大，部分用户可能误读为‘STACK SKY’中间有断开 |
| tests/final/02-title-zh.png | 8 | 5 | 9 | Y | N | N | Y | 底部塔形结构模糊且未对齐中心，无法辨识是否为玩家角色或可交互物；‘最高 0 层’文字颜色过浅（浅灰），在米黄背景上对比度不足，易被忽略；右上角语言切换下拉框无展开箭头图标，交互意图不明确 |
| tests/final/03-tutorial.png | 8 | 6 | 9 | Y | N | N | Y | 中央提示框‘Tap or press Space to drop the island’与下方绿色条部分重叠，可能误触；左上角HUD数值（HEIGHT 0等）字体偏小，弱光下辨识度低；云朵剪影缺乏层次，眯眼时白色云与浅黄背景对比不足，易混淆可交互平台 |
| tests/final/04-play.png | 8 | 7 | 9 | Y | N | N | Y | 顶部‘Dawn Clouds’标签无明确交互提示，易被误认为装饰；左侧HUD数值（HEIGHT/WIDTH/PERFECT）字体偏小，弱光下辨识度低；绿色堆叠块间虚线对齐指示线过细，远距离或小屏可能看不清 |
| tests/final/05-wind.png | 8 | 7 | 9 | Y | N | N | Y | 顶部‘Dawn Clouds’标签无明确交互提示，易被误认为装饰；左侧HUD数值（HEIGHT/WIDTH/PERFECT）字体偏小，弱光下辨识度低；堆叠块中心虚线对齐标记在移动中可能难察觉，影响精准操作 |
| tests/final/06-cloudwrap.png | 8 | 7 | 9 | Y | N | N | Y | 顶部‘Dawn Clouds’标签无明确交互提示，易被误认为装饰；左侧HUD数值（HEIGHT/WIDTH/PERFECT）字体偏小，弱光下辨识度低；堆叠块顶部黄色块与下方绿色块对比度不足，眯眼时轮廓略模糊 |
| tests/final/07-storm.png | 7 | 8 | 9 | Y | N | N | Y | 左上角HUD数值（HEIGHT/WIDTH/PERFECT）字体偏小，3秒内需细看才能辨识单位；‘Storm Layer’标签无明确交互提示，易被误认为装饰性文字；顶部发光方块与下方堆叠块对比度不足，弱光环境下可能难辨边界 |
| tests/final/08-mobile-play.png | 7 | 8 | 9 | Y | N | N | Y | 左上角HUD数值（HEIGHT/WIDTH/PERFECT）字体偏小，3秒内需细看才能辨识单位与数值关系；顶部' Dawn Clouds'标签无明确交互指示，易被误认为装饰性文字；堆叠平台中间虚线对齐标记过细，在低分辨率下可能不可见 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

