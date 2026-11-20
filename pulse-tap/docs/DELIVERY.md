# PULSE TAP · 交付报告

## 1) 源码分析摘要（原作玩法事实）

参考源码 `local/src1/音乐节奏/MusicBall/`（Cocos Creator 2.x 节奏类壳），核心判定逻辑在：

- `assets/Script/Layer_1.ts:127-136`：由 `level100002.json` 的 `tracks[].note[]` 生成下落 note（原作 2 轨）。
- `assets/resources/level100002.json`：note 字段 `{tick,key,dur,isEnd,toTrack,volume,pan,attr}`；`dur==0` 单点、`dur>0` 长按。
- `assets/Script/Musicbutton.ts:61-100`：note 沿轨道下落，`node.y = -620 * 2^(scale/100)`，`scale` 随帧递增。
- `assets/Script/Musicbutton.ts:102-119`：越过第一临界点后可点、越过第二临界点未点则 `sethp()` 扣血。
- `assets/Script/Musicbutton.ts:138-144`：判定分档 `|临界点y - node.y| ≤130 → +10 分，否则 +5 分`（Perfect/Great 雏形）。
- `assets/Script/Musicbutton.ts:133-136,146-156`：长按 `changan=true` 持续跟随，松手结算。
- `assets/Script/Layer_1.ts:89,224-231`：血量 3 心，Miss 扣 1 心，归零 `gameshibai()`。
- `assets/Script/Layer_1.ts:262-265`：一首歌 40 秒，`shijian/40` 驱动进度条。
- `assets/Script/lighting.ts:28-41`：背景灯光沿轨道往返运动。

## 2) 改造点清单

**保留（P0 规则 1:1）**：note 沿轨道下落、到判定线点击、Perfect/Great/Miss 分档、连击与断连惩罚、Miss 扣血归零失败、谱面驱动（时间点+轨道+时值）、长按 note。

**改造**：
- 2 轨 → **4 轨**，键位 **D/F/J/K**（触屏四轨点击/长按/滑动）。
- 判定窗口**量化并写进 config 单测**：Perfect ±60ms / Great ±120ms / Miss 其余。
- 谱面从 JSON 静态表 → **seeded 程序化生成**（与内置节拍锁相，12 关逐关递进）。
- 新增 **滑键**（相邻轨 slideStart→slideEnd 触发 slideChain）、**假 note**（灰色不可点，点它扣血）、**和弦**（多轨同拍）。
- 新增 **律动模式**（signature）：连续 8 次 Perfect → 背景随拍呼吸 + 判定窗口放宽（±60→±75ms）。
- 血量细化：Miss −20 / 假 note −12 / 长按提前松手 −10。

**原创主题**：心跳夜店 DJ 台 + 三套场景（霓虹吧 / 天台电音 / 深夜地铁）；全程序化 Canvas 美术；WebAudio four-on-floor BGM（BPM 120）+ 15 类 SFX。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 21 pass / 0 fail |
| `tools/selfplay.mjs` | ✅ greedy 通关到达第 3 关（dur 144s, 153 actions, levels 3, completed） |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass） |
| `verify-game.mjs` | ✅ pass（60fps / 0 console error / 0 失败请求） |
| `i18n-check.mjs` | ✅ en/zh 各 39 key，0 缺 0 空 |
| `tutorial-check.mjs` | ✅ PASS（3 步、可跳过、持久化、可重看） |
| `sdk-check.mjs` | ✅ pass（SDK 就绪/降级/广告/埋点/存档/分享全过） |
| `audio-check.mjs` | ✅ PASS（BGM 16s 无缝循环 + 12 组 SFX RMS/时长/峰值） |
| `vision-review.mjs` | ✅ **WARN**（readable 7.9 / silhouette 7.4 / style 8.8，无 critical） |

## 4) 物料路径

- `poster.jpg`（1280×720，真实标题屏 + 大标题贴纸字）
- `poster-1920.jpg`（1920×1080）
- `game.gif`（480×270，5.0s 循环，1.85MB，前 3 秒为真实节奏命中）
- `SEO.txt`（五个大写关键词 TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION，中英双份）
- `icon.png`（256×256）+ `favicon.png`（32×32）
- `tools/`：`make-shots.mjs` / `make-poster.mjs` / `make-icon.mjs` / `record-gif.mjs` 可复现全部物料

## 5) 未做项与已知问题

- 未接广告账号（`config/sdk.config.js` `ads.enabled=false`、`source='local'`），广告 UI 与激励奖励留待上线配置。
- `vision-review` 判定为 WARN（readable 7.9 略低于 8.0 的 PASS 线）：机器评审反复指出「HP 条与右上角图标组间距偏密」与「D/F/J/K 键位标签在暗背景下亮度偏低」，属可读性优化项，非阻断。
- 滑键判定为「首 note + 相邻轨 slideEnd 双 tap」，未实现真正的手势滑动轨迹检测（品类体验一致，机制说明见 docs/README.md）。

## 6) 最不满意的一处

**长按 note 的视觉可读性。** 半透明长条 + 白描边头部已经能表达「点住」，但机器评审仍多次把蓝色长条读作「不知道是该点还是该躲的目标」。节奏类 hold 的「按满全程」反馈（头部高光 → 尾部收光）没有做得足够清晰，是目前最想回头重做的一处。
