# 截图自动评审 — sway-blocks

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 7.9 / silhouette 8.1 / style 9.3

**结论：WARN**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-title.png | 9 | 7 | 8 | Y | N | N | Y | 关卡选择按钮（1-6）星标颜色不一致：第1关为黄色，其余为灰白，易误判当前选中项；‘0 / 18’进度显示字体过小且无明确标签，可能被忽略；标题‘SWAY BLOCKS’与副标题‘Swing · Drop · Balance’间距略紧，轻微影响层级辨识 |
| tests/final/02-playing.png | 8 | 9 | 10 | Y | N | N | Y | 顶部 'Blocks 0/3' 文字与左侧 'Level 1 · First Stack' 间距过小，略显拥挤；虚线轨迹起始点（顶部小圆点）太小，易被忽略，影响操作预判；靶心中心蓝点与外环对比度偏低，远距离辨识稍弱 |
| tests/final/03-result.png | 9 | 6 | 8 | Y | N | N | Y | 中央‘Balanced!’文字与三颗星之间间距略小，视觉层级稍弱；；底部模糊竖条疑似残留UI元素或未清除的动画残影，影响silhouette判断；；‘Score: 600’字体偏小且无高亮，对比度不足，易被忽略 |
| tests/final/04-playing-l2.png | 8 | 9 | 10 | Y | N | N | Y | 虚线轨迹起始点（顶部小圆点）过小，易被忽略；；靶心内粉点与外环对比度偏低，可能影响精准判断落点；；‘Blocks 0/3’未明确说明‘Blocks’指代什么，新手可能困惑 |
| tests/final/05-playing-l3.png | 7 | 8 | 9 | Y | N | N | Y | 目标靶心与底板间距过小，可能误触底板而非靶心；悬挂冰块的虚线轨迹未明确指示可交互区域（如无拖拽手柄）；‘Blocks 0/3’未说明如何获取冰块，新手易困惑 |
| tests/final/06-playing-rock.png | 7 | 8 | 9 | Y | N | N | Y | 目标靶心与下方长条平台视觉层级接近，可能误判为可交互物；虚线轨迹起始点（顶部小圆点）过小，易被忽略；‘Blocks 0/3’未明确指示‘需放置3个方块’，语义稍模糊 |
| tests/final/07-playing-conveyor.png | 7 | 9 | 10 | Y | N | N | Y | 顶部 'Level 5 · Conveyor' 和 'Blocks 0/3' 文字间距过小，略显拥挤；目标圆环与底座紫色描边亮度接近，弱对比下可能误判为整体；虚线轨迹起始点（顶部小圆点）太小，易被忽略 |
| tests/final/08-mobile.png | 8 | 9 | 10 | Y | N | N | Y | 靶心与底座间距过小，可能影响精准操作判定；虚线轨迹起始点在屏幕外，轨迹不完整易误导路径预期；‘Blocks 0/3’未明确说明‘Blocks’指代什么（方块？堆叠数？） |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

