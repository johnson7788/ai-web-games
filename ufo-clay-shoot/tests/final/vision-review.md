# 截图自动评审 — ufo-clay-shoot

> 6 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.8 / silhouette 6.3 / style 8.5

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 3 | 8 | Y | N | N | Y | 标题‘UFO CLAY SHOOT’与副标题间距过小，略显拥挤；‘Best time 0.0s’字体颜色偏黄，在深蓝背景下对比度不足，易被忽略；无玩家/敌人/子弹等游戏元素可见，无法评估 silhouette（当前为启动页） |
| tests/final/02-battle.png | 9 | 8 | 9 | Y | N | N | Y | 紫色菱形道具（标'3'）与红色飞碟敌人距离过近，易误判为敌人或干扰瞄准；左上角'Combo x1'文字颜色（粉紫）与背景对比度偏低，弱光下可能难辨；顶部目标提示框轻微遮挡上方橙色飞碟边缘（约1-2像素） |
| tests/final/03-battle2.png | 8 | 7 | 9 | Y | N | N | Y | 橙色飞碟状敌人与紫色菱形（可能为道具）在视觉上易混淆，轮廓相似度高；左上角'Combo ×3'文字背景为深紫渐变，与深蓝背景对比度偏低，弱光下可能难辨；底部玩家飞船发光效果过强，轻微溢光遮盖下方网格线，影响定位精度 |
| tests/final/04-result.png | 9 | 6 | 8 | Y | N | N | Y | 背景模糊光斑干扰视觉焦点，可能影响‘silhouette’判断；；‘Run Over’标题与三颗星间距略紧，小屏下易误读为整体元素；；‘Best time 1.6s’使用黄色字体，与上方‘Combo ×3’颜色冲突，削弱层级区分 |
| tests/final/05-m-title.png | 9 | 6 | 8 | Y | N | N | Y | ‘Best time 0.0s’为黄色，与主标题蓝白霓虹风格略有冲突，可能削弱视觉层级；‘Neon arcade skeet · blast the clay saucers’字号过小且无描边，在深蓝背景下对比度偏低；右上角语言选择框无明确选中状态指示（如下拉箭头样式模糊） |
| tests/final/06-m-playing.png | 9 | 8 | 9 | Y | N | N | Y | 红色敌人轮廓发光过强，与背景网格线轻微融合，影响远距离辨识；左上角'Combo ×1'标签底色与'Score 44'不一致（黄底 vs 紫底），风格微冲突；提示框文字‘Shoot the clay saucers – survive!’中破折号为英文en-dash但字体略窄，视觉稍突兀 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

