# 截图自动评审 — ocean-dash

> 8 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.0 / silhouette 7.4 / style 8.9

**结论：PASS**

| 截图 | 看懂 | 剪影 | 风格 | 目标可见 | HUD 遮挡 | 文字裁切 | 移动安全 | 问题 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| tests/final/01-play.png | 7 | 8 | 9 | Y | N | N | Y | 左上角HUD标签（SEGMENT/RANK/SCHOOL）文字偏小，3秒内需细看才能辨识数值；右上角'FINISH'目标区域与GATHER/GLIDE按钮间距过近，可能误触；主鱼群路径上方有半透明弧线轨迹，与水面交界处略模糊，影响路径判断 |
| tests/final/02-gather.png | 7 | 8 | 9 | Y | N | N | Y | 左上角HUD文字‘SCHOOL 6’与‘RANK 1/4’间距过小，易误读为‘SCHOOL 6 RANK 1/4’；右上角‘FINISH’目标区域无明确视觉引导（仅小方块），新手可能忽略；水下气泡与背景光束同色系，部分气泡在深区辨识度偏低 |
| tests/final/04-mobile.png | 7 | 8 | 9 | Y | N | N | Y | 左上角HUD‘SEGMENT 1’‘RANK 1/4’‘SCHOOL 5’文字过小，3秒内不易快速识别层级关系；水面分界线处有一条细长青色竖线（疑似UI残留或未对齐元素），位置在X≈260，可能为视觉干扰；右上角‘GATHER’‘GLIDE’按钮无悬停反馈提示，且‘GLIDE’按钮下方有微小白色横条（疑似图标裁切残留） |
| tests/final/05-title.png | 9 | 6 | 8 | Y | N | N | Y | 标题‘OCEAN DASH’发光效果过强，部分字母边缘轻微溢光，可能影响小屏阅读；‘Best segment 1’为黄色，与主色调（青绿）不一致，风格略突兀；控制提示文字（↑↓ / WS steer · hold Space gather · J jump）字号偏小，弱光环境下辨识度下降 |
| tests/final/06-result.png | 9 | 5 | 8 | Y | N | N | Y | 背景模糊导致玩家角色/赛道轮廓不可见，silhouette得分低；‘Outpaced’标题无明确状态指示（如‘You were outpaced’），轻微歧义；‘Press R to race again’提示字号偏小，弱光环境下可能难辨 |
| tests/final/tutorial-after-skip.png | 8 | 9 | 10 | Y | N | N | Y | 右上角'FINISH'标签部分被绿色进度条遮挡（轻微）；左上角HUD信息未说明'SEGMENT'/'RANK'/'SCHOOL'具体含义，新手可能困惑；水面光束与背景融合较深，可能影响中景物体辨识（如右侧弧形障碍物） |
| tests/final/tutorial-first.png | 8 | 9 | 10 | Y | N | N | Y | 左上角 HUD 标签（SEGMENT/RANK/SCHOOL）字体过小，远距离辨识度低；中央提示框 'FIRST MIGRATION' 字体颜色偏暗，与深蓝背景对比度不足；右侧垂直操作栏（GATHER/GLIDE/Skip）未对齐，Skip 按钮略高于其他按钮 |
| tests/final/tutorial-replay.png | 9 | 6 | 8 | Y | N | N | Y | ‘Best segment 1’文字颜色偏黄，与主色调（青绿）不一致，易被忽略；‘FIRST MIGRATION’提示框无明确指向性，玩家可能不确定是否需先完成该步骤才能点Race；‘Skip’按钮位置偏右上且尺寸小，与整体UI层级感弱，易被忽略 |

## 说明

- 这是视觉模型按 rubric 打的分，不是人类审美；它用来抓「看不见目标、HUD 遮挡、文字裁切、风格拼接」。
- 所有截图都应来自真实运行（verify-game / playtest），不是设计稿。
- FAIL 项进修复单；改完重跑，直到 ≥WARN。

