# 截图自动评审 — vault-run

> 5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.4 / silhouette 6.6 / style 8.2

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/desktop.png | 9 | 7 | 8 | Y | N | N | Y | ‘Best 0’数字‘0’字号过小且无单位说明，易被忽略；背景建筑剪影在远处渐变模糊，部分结构边界不清，影响深度判断；‘How to play’按钮边框与‘Start’不一致（圆角半径/描边粗细），风格微瑕 |
| tests/final/mobile.png | 9 | 7 | 8 | Y | N | N | Y | ‘Best 0’数字‘0’颜色偏黄，与背景暖色调对比不足，易被忽略；‘How to play’按钮边框为紫色，与主按钮橙色风格略有冲突；背景建筑剪影层次丰富但缺乏明确玩家位置指示（如角色模型或起始点标记） |
| tests/final/tutorial-after-skip.png | 7 | 6 | 8 | Y | N | N | Y | 屋顶前景过暗，玩家角色未明确显示，难以分辨自身位置与边界；远处建筑剪影层次模糊，关键目标‘ROOFTOPS’虽标出但无视觉引导箭头或高亮；Stamina条颜色与背景融合度高，低对比下易忽略 |
| tests/final/tutorial-first.png | 8 | 6 | 9 | Y | N | N | Y | 玩家角色未显示（仅见屋顶路径），无法确认当前角色位置与轮廓；教程弹窗遮挡部分远景建筑，影响空间判断；Stamina条无标签文字说明（仅图标+颜色），新手可能不解其意 |
| tests/final/tutorial-replay.png | 9 | 7 | 8 | Y | N | N | Y | 对话框顶部三圆点（窗口控件）与游戏UI风格不一致，疑似系统窗口样式混入；‘Skip tutorial’按钮边框为橙色描边但无填充色，视觉层级弱于主提示文本；背景渐变过强，可能干扰深色HUD的对比度（尤其在低亮度设备上） |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

