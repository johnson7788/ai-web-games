# PULSE TAP（脉冲节拍）· 设计源与契约

> 参考源码：`local/src1/音乐节奏/MusicBall/`（Cocos Creator 2.x 音乐节奏游戏壳）。
> 路线：**提取重写**（玩法规则 P0 1:1 还原，角色/场景/音乐全原创）。
> 结论：这是本仓库 `games/pulse-tap/` 的唯一契约页。

## 0. 一句话 / 身份

- **一句话**：在心跳夜店的 DJ 台上，四条霓虹能量轨落下脉冲，玩家在判定线按 DFJK 点中节拍——连击 8 次 Perfect 触发律动模式，漏拍扣血，清完整首曲子赢下这一盘。
- **身份四元组**：hook=「四轨霓虹脉冲下落，掐准节拍点灯」/ verb=tap+hold+slide / world=心跳夜店 DJ 台 / signature=连续 8 次 Perfect 后整座 DJ 台进入「律动模式」（背景随拍呼吸 + 判定窗口微放宽）。
- **品类**：节奏（rhythm / arcade）。难度来自节奏准确度与专注取舍。
- **反范围（本版不做）**：不做在线对战、不做谱面编辑器、不做商店/氪金、不做每日挑战、不做排行榜、不做皮肤系统。

## 1. 参考玩法事实（源码）

P0 必须还原的规则（源码行号）：

| 事实 | 源码 |
| --- | --- |
| note 由谱面 JSON 生成，两轨 `track: 5/6` | `assets/Script/Layer_1.ts:127-136` |
| note 字段 `{tick, key, dur, isEnd, toTrack, volume, pan, attr}`，`dur==0` 单点、`dur>0` 长按 | `assets/resources/level100002.json` |
| note 沿轨道下落，`node.y = -620 * 2^(scale/100)`，scale 随时间递增 | `assets/Script/Musicbutton.ts:61-100` |
| 判定：note 越过临界点后可点击，越过第二临界点未点击即漏判扣血 | `assets/Script/Musicbutton.ts:102-119` |
| 判定分档：|临界点 y − node.y| ≤130 得 10 分，否则得 5 分 | `assets/Script/Musicbutton.ts:138-144` |
| 长按：按住时 `changan=true`，持续跟随，松手结算 | `assets/Script/Musicbutton.ts:133-136, 146-156` |
| 血量 3 心，Miss 扣 1 心，归零失败 | `assets/Script/Layer_1.ts:89, 224-231` |
| 一首歌 40 秒，`shijian` 计时，进度条随 `shijian/40` 推进 | `assets/Script/Layer_1.ts:262-265` |
| 背景灯光轨道运动（lighting） | `assets/Script/lighting.ts:28-41` |

P1 同构（反馈节奏）：命中高亮 / 判定飘字 / 连击计数 / 断连惩罚 / 结算卡。
P2 原创（全部重做）：心跳夜店主题、三套场景、程序化霓虹美术、WebAudio BGM/SFX。

## 2. 玩法改造

在 P0 骨架上（2 轨 → 4 轨，键位 DFJK）新增：

1. **四轨**：D/F/J/K 四键 + 触屏四轨点击（原作为两轨触屏）。
2. **判定窗口**：Perfect ±60ms / Great ±120ms / Miss 其余（写入 config 并单测）。
3. **连击与断连惩罚**：combo 累计；Miss / 空轨 / 假 note / 长按提前松手都断连。
4. **血量**：Miss 扣 20、假 note 扣 12、长按提前松手扣 10，归零失败。
5. **律动模式（signature）**：连续 8 次 Perfect 进入，背景随拍呼吸 + 判定窗口放宽（Perfect ±60→±75ms）。
6. **12 关推进**：单点 → 双轨交替 → 长按 → 滑键 → 变速 → 密度爬升 → 假 note → 和弦 → 律动耐力 → 切分 → 冲刺 → 终章全曲。
7. **三章场景包**：霓虹吧 / 天台电音 / 深夜地铁。

## 3. 数据契约

- 逻辑世界 1280×720；60Hz 固定步长；`STEP=1/60`。
- sim 纯逻辑（零 DOM），`createRun(levelIndex, {seed})` 注入 mulberry32 谱面可复现。
- `run.state`：`phase(countdown|playing|won|lost)` / `time` / `duration` / `notes[]` / `hp` / `score` / `combo` / `maxCombo` / `perfect` / `great` / `miss` / `groove` / `heldTrack[4]` / `result`。
- `note`：`{id,time,track,dur,kind(tap|hold|slide|slideEnd|fake),toTrack,slideTime,status,grade}`。
- 事件表：`countdownTick/songStart/beat/noteSpawn/noteHit/noteMiss/holdStart/holdEnd/holdBreak/slideStart/slideChain/fakeHit/ghostTap/combo/comboBreak/grooveOn/grooveOff/hpLost/win/lose`。
- `run.tap(track)` / `run.release(track)` / `run.step(dt)` / `run.getHud()` / `run.drainEvents()`。
- 状态机（main）：`title → playing → paused → result → title`。

## 4. 视觉与音频

- 场景包三套（色板/构图/装饰互异）：neon-bar（深紫+霓虹光束+均衡器灯箱）、rooftop-electro（夜空+天际线+探照灯）、midnight-subway（隧道连排灯+纵深透视线+车窗剪影）。
- 四轨霓虹色：粉 `#FF3D81` / 青 `#27D6F6` / 绿 `#54F08A` / 黄 `#FFC842`。
- note 造型：单点=发光能量 pill、长按=半透明长条+白描边头部（向下箭头）、滑键=带指向箭头、假 note=灰色+白叉。
- 音频：WebAudio 全程序化。BGM four-on-floor BPM 120（A 小调 Am–F–C–G，四层：底鼓/踩镲/贝斯/铺底琶音，8 小节无缝循环）。SFX：perfect/great/miss/holdStart/holdEnd/holdBreak/slideChain/fakeHit/grooveOn/grooveOff/beat/countdown/songStart/win/lose。

## 5. 验收

`node --test` / `tools/selfplay.mjs` / `verify-game` / `i18n-check` / `audio-check` / `sdk-check` / `fun-audit` / `fun-report` / `vision-review` / `tutorial-check`。
