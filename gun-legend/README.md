# GUN LEGEND · 枪神传说

霓虹港片巷战双枪射击（改造自 Cocos 源码《枪神之神》的射击核心）。纯静态 Canvas，零构建、零运行期依赖。

## 一句话

玩家在港片雨巷里用指针瞄准、双枪轮流连火、翻滚闪避弹幕，双枪同时清空时触发白鸽飞过的吴宇森时刻。

## 8 问

1. **一句话**：见上。
2. **参考**：品类借鉴弹幕清关（如 twin-stick shooter），不抄任何素材/角色/UI。
3. **差异化**：① 双枪换弹节奏（一把打空无缝切另一把）；② 白鸽时刻（双枪同时清空 = 慢动作 + 免费满膛 + 连杀）；③ 换弹舞（节奏窗口内点击缩短 30%，乱点打空弹匣）。
4. **操作**：鼠标/触屏指针瞄准 + 点击/长按开火，Shift/触屏按钮翻滚，R 换弹。
5. **一局**：12 场波次清关，血量归零失败；爽点在第 3 秒第一杀、第 12 发双枪清空的白鸽。
6. **成长**：局内——武器解锁（左轮→散弹→双持冲锋）+ 连杀倍率；跨局——最佳场次/最佳得分存档。
7. **结局**：通关 12 场 → 胜利结算；死亡 → 「枪神陨落」结算卡；重开一键回到巷口。
8. **乐趣**：mastery（翻滚时机 + 换弹节奏）+ expression（贴脸散弹 vs 远程压制的打法选择）。第 3 分钟想继续 = 冲连杀倍率与白鸽时刻。

## 数据契约（摘要）

- 世界 1280×720，60Hz 固定步长；玩家固定 (640,560)，翻滚横向位移。
- 实体：`player{x,y,radius,hp,rollCd,invulnUntil}`、`enemy{id,type,x,y,hp,radius,…}`、`bullets`（玩家）、`enemyBullets`、`grenades`。
- 事件：`shot/hit/kill/enemyShot/playerHit/rollStart/rollEnd/reloadStart/reloadDone/reloadDance/reloadFail/dove/explosion/grenadeThrown/waveStart/waveCleared/roundStart/roundCleared/roundEnter/sceneEnter/weaponUnlock/comboUp/comboBreak/milestone/scoreMilestone/nearMiss/death/victory/gunSwitch`。
- 模块：`createRun({seed})→{step(input),getHud(),drainEvents()}`；`Render.draw(run,alpha)`；`UI.show(screen)`；`Audio.event(type)`。
- 输入：`{aimX,aimY,fire,roll,reload}`（held 布尔，sim 内部做 rising-edge）。
- 状态机：`boot → title → playing ⇄ paused → dead|won`。

## 反范围（不做）

联网/排行榜、皮肤商店、每日任务、剧情对话、竖屏专属模式。

## TODO（门禁 WARN 项，G7 对账）

- `vision-review` 判定 WARN（readable 均值 7.9，门槛 8 才 PASS）：标题屏 silhouette 偏低（3），可在标题屏叠加更清晰的角色剪影或改为游戏内英雄截图。
