# blindbox-memory — 设计源（G0/G2 交付物）

## 一句话
在步数预算内翻开盲盒潮玩卡牌配对成对，连击攒金币、集齐 31 个 AI 潮玩角色图鉴。

## 八问
1. **一句话**：见上。
2. **参考**：经典 memory match / 配对翻牌（品类借鉴）；美术为自有 ComfyUI 生成潮玩盲盒角色池。
3. **差异化**：① 448 张真实 AI 潮玩卡池按「确定性检测+视觉逐张判定」筛出 31 张单主体卡；② 同族相似卡做成 decoy 辨析关（不是缺陷是机制）；③ 图鉴收集 + 商店规则升级 meta。
4. **操作**：点击/触屏翻牌，数字键 1-9 可达；3 秒看懂。
5. **一局**：60-180s；失败=步数用尽；爽点=连击返还与星卡三倍金币。
6. **成长**：局内连击/提示/复活；跨局星级、金币、图鉴、8 个升级。
7. **结局**：过关（星级+金币+下一关）/ 失败（复活广告位+重开）/ 全收集。
8. **乐趣**：好奇（盲盒收集）+ 掌控（记忆 mastery）；第 3 分钟钩子=图鉴差 N 个全收集+每日同种子。

## 签名记忆点
「翻开一张盲盒卡，永远不知道下一个潮玩是谁」——海量角色池随机上桌。

## 反范围（本版不做）
在线对战、角色养成战斗、3D、剧情、排行榜、每日签到 UI、追加语言。

## 美术来源
素材池 `/Users/admin/Downloads/comfyui`（flux/qwen 生成潮玩角色）；选卡管线 `tools/select_cards_v4.py` + 视觉逐张判定；BGM=minimax-music-2.5 生成（25.9s 循环）；SFX=WebAudio 合成；UI=纯 CSS 糖果皮肤。

## 契约要点
- 坐标/布局：DOM 卡牌栅格（`--rows`/cols），HUD 顶栏；无 canvas。
- 实体：`run.deck[] = {id, char, kind(normal|star|obstacle), mirrored, state(down|up|matched)}`。
- 事件（sim 发）：`flip/obstacle/match/mismatch/shuffle/peek/revive/peek_refund/combo_refund/win/fail`。
- 模块 API：`createRun/flipCard/peekPair/revive/refillPeeks/starsFor/drainEvents`。
- 状态机：`title → game → (win|fail) → …`；`pause` 可从 `game` 进出。
- 输入边沿：click/touch 由 UI 层归一，误配 750ms 翻回锁输入。

## 验收证据（G5）
- `node --test` 16/16；fun-audit 100/100 PASS；fun-report 10-0-0 PASS；vision-review PASS（8.6/7.3/8.9）；verify-game 60fps 0 error；tutorial-check PASS；i18n en/zh 62 keys 完整；asset-check PASS；sdk-check PASS（含断网降级）。
- 线上：https://pipygames.com/games/blind-box-memory-flip-match-collect-u7uz （桌面 iframe 内真实点击配对 ✓，iPhone UA 触屏翻牌 ✓；平台侧 React #418 水合错与 iframe 偶发不挂载为全站问题，非本包）。

## TODO（无 WARN 项）
fun-audit 无 WARN；vision-review 提示的对比度小项（toast 衬底、HUD 字号）留待后续打磨。
