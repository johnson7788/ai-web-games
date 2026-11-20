# jungle-chess 交付报告（翡翠林棋会）

## 1) 源码分析摘要（原作玩法事实，带文件:行号）

源码位于 `local/src1/斗兽棋-creator/dsq/assets/Battle/Script/games/`。读完后确认：**原作其实是一款 4×4 的「翻翻棋（暗棋）」，不是经典 7×9 斗兽棋**——但 8 兽种等级与吃子关系被完整保留，是 spec 要求「规则 1:1」的那部分。

- `GameEngine.ts:24-25`：`MAX_CARD = 16`、`MAX_CHAIR = 2`，4×4 共 16 张牌、双人对弈，牌面初始为 `DARK_CARD`（暗牌，先翻开再走子）。
- `GameEngine.ts:72-76`：`cards` 数组给出 8 兽种编码——鼠(0x00/0x10)、猫(0x01)、狗(0x02)、狼(0x03)、豹(0x04)、虎(0x05)、狮(0x06)、象(0x07)，蓝红各 8。等级序「象>狮>虎>豹>狼>狗>猫>鼠」由此确定。
- `GameEngine.ts:258-285`（`move()`）：核心吃子判定——`fromV > nextV` 强者吃弱者；`fromV == nextV` 同级互吃（276-278 行双方同归于尽）；`fromV==7 && nextV==0`（象 vs 鼠）与 `fromV==0 && nextV==7`（鼠 vs 象）两条特判（270-274、280-284 行）——**鼠可吃象**。
- `GameEngine.ts:306-327`（`checkWin()`）：全翻开后，一方棋子被吃光判负。
- `GameEngine.ts:365-376`（`canMove()`）：4×4 相邻判定（`Math.floor(from/4)` 分行列），同色不可走、暗牌不可走。
- `Config.ts:6-13`：仅剩 `AI_FIRE / HUMAN_FIRE` 两条事件字符串，是联网 DTO/事件剥除后的痕迹。
- 联网 DTO（`dto/SitDownDTO.ts`、`MoveCardDTO.ts`、`EndGameDTO.ts` 等）、`PlayerManager.ts`、`UIBattleMgr.ts` 等联网/大厅层全部未采用，按 spec「联网 DTO 全部剥离」。

结论：河域、陷阱、兽穴、狮虎跳河这四套经典斗兽棋地形规则在源码里**不存在**（源码是 4×4 暗棋）。这四项按 spec §P0 逐条新实现，与 8 兽种等级/鼠吃象/同级互吃一起，构成完整的经典斗兽棋规则。

## 2) 改造点清单

**保留（原作规则事实）**
- 8 兽种等级序与吃子关系：象>狮>虎>豹>狼>狗>猫>鼠、鼠可吃象、同级互吃（`src/game/rules.js` 的 `captureOutcome`）。

**改/新实现**
- 从 4×4 暗棋 → 经典 7×9 斗兽棋：河域（仅鼠可下水、水中仅鼠互吃）、陷阱（敌踩己方陷阱任意被吃）、兽穴（占穴即胜、己穴不可入）、狮虎跳河（直线越水、无鼠阻挡）。
- 联网双人对弈 → 单机 12 关：前 6 关「一步杀/两步杀」谜题 + 后 6 关完整对局，AI 三档 minimax（随班=深度1 / 学长=深度2 / 长老=深度3 / 第12关完美=深度4，`src/game/ai.js`）。
- 原创主题「翡翠林棋会」：翡翠雨林棋盘（林/河/陷阱/兽穴可视化）+ 程序化萌系兽首徽章（形状+颜色双编码阵营、兽首形状区分兵种）+ 三场景包（晨雾林/雨季林/夜鸣林）。
- 签名记忆点：吃子瞬间藤蔓缠绕动画（`src/render/index.js` 的 `drawVines`）、获胜时兽群归巢巡游。
- 其余照黄金参考 oasis-pipeworks：`window.__ll` 调试契约、SDK 统一出口（`src/core/sdk.js` + `config/sdk.config.js`，appId `pipy-jungle-chess`）、程序化 WebAudio 四层 BGM+SFX、英文默认+中文完整、首次交互引导（3 步可跳可重看持久化）。

## 3) 每条门禁最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 38 pass / 0 fail（规则/AI/谜题可解性/sim 状态机） |
| `tools/selfplay.mjs` | ✅ 3 策略（greedy/random/noinput）；greedy 通关到达第 3 关 |
| `fun-report` | ✅ PASS（10 pass / 0 warn / 0 fail） |
| `fun-audit` | ✅ PASS 100/100（26 pass） |
| `verify-game` | ✅ pass：60fps（avgFrameMs 16.67）、0 console/page error、0 失败请求 |
| `i18n-check` | ✅ en/zh 各 66 key，missing/empty 均 0 |
| `tutorial-check` | ✅ PASS（visible/active/3 steps/skip/persisted/replayable 全 true） |
| `sdk-check` | ✅ pass（10/10 全绿，含降级/存档/分享/埋点） |
| `audio-check` | ✅ PASS（BGM 38.4s 无缝循环 + 10 个 SFX 全部过 RMS/时长/峰值） |
| `vision-review` | ✅ PASS（readable 8.8 / silhouette 7.6 / style 9.0，无 critical） |

## 4) 物料路径

- `poster.jpg`（1280×720，真实标题屏+贴纸标题）
- `poster-1920.jpg`（1920×1080，同法放大）
- `game.gif`（480×270，4.86s 循环，568KB ≤2MB，前 3 秒即见选子→跳河→藤蔓吃子）
- `SEO.txt`（中英双份，TITLE/CATEGORY/TAGS/SHORT/LONG 五关键词）
- `icon.png`（256×256，狮首徽章） / `favicon.png`（32×32）

## 5) 未做项与已知问题

- 未接广告账号：`config/sdk.config.js` 的 `ads.enabled=false`（按 brief 要求，上线前改 `source:'online'` 并开启广告）。
- 联网/排行榜/多人对弈未做（spec 明确剥离）。
- AI 长老档为确定性 minimax（无随机开局扰动），高手反复对弈可摸清套路；第 12 关深度 4 在低端机上有 ~百毫秒级思考延迟（已用 alpha-beta + 吃子优先排序缓解）。
- vision-review 提到的「兽类等级图例图标与文字间距略不均」「水域无图例」为 WARN 级观感项，不影响门禁，已记录待 G7 复盘。

## 6) 最不满意的一处

**谜题关的「河域/鼠入河」教学不够直接**：斗兽棋里「鼠在水中只能与鼠互吃」本质是互吃（同归于尽），很难做成「一步吃关键子即胜」的干净谜题，最终 L5/L6 用「虎/狮跳河吃关键子」来讲河域与跳河，而「鼠入河避险」这条 P0 规则只隐式地存在于完整对局里、没有一条谜题专门点透。如果重做，我会给谜题加「第 3 步内鼠下水逼和/制造跳河通路」这类更贴合鼠下水语义的胜利条件，而不是只用吃子兜底。
