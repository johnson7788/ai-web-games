# NOTE RIDER · 交付报告

改造自 Cocos 音乐游戏 `local/src1/音乐游戏 cocos/music/`（节奏轨道 + 怪物 + 技能升级的跑打结构）。

## 1) 源码分析摘要（原作玩法事实）

- **双轨 note 跑打**：左/右两条轨道（`tracks[0]`→`upVec.y`、`tracks[1]`→`downVec.y`），note 按音频时间从右向左逼近判定线 `trackX=-365`（`module/battle/BattleMediator.ts:35,306-321`）。
- **节拍换算**：`tempoTime = 60/bpm*1000`，`speed = tempoWidth/tempoTime`（`tempoWidth=150`，`tempoNum=7`）（`BattleMediator.ts:37-39,198`）。
- **输入=左右两键**：`A`→`onTouchLeftStart`→`hitNote("A")`，`D`→`onTouchRightStart`→`hitNote("B")`（`BattleMediator.ts:359,387`）。
- **判定分级按距离**：`dis` 20/30/45/60 → score 30/20/10/5（`core/manager/ConfigManager.ts:172` 的 `getGrade`；`resources/preload/json/Grade.json`）。
- **怪物三型**：`Normal=1`（单点击杀）/`Double=2`（左右同按）/`Noodle=3`（长按蓄力）（`core/enmu/MonsterTypeEnmu.ts`；`BattleMediator.ts:423-441`）。
- **技能 6 个**：10001 加无敌 / 10002 攻击 / 10003 双重攻击 / 10004 持续伤害 / 10005 加血 / 10006 持续加血（`resources/preload/json/Skill.json`）。
- **怪物血量与反击**：`EntityVO.Hp` setter 扣血至 ≤0 派发 `ENTITIY_DIE`（`core/entity/EntityVO.ts`）。
- 原作仅为 3 关（`resources/preload/json/Level.json`），无成长/结算闭环，note 依赖真实音频时间（`cc.audioEngine.getCurrentTime`）。

## 2) 改造点清单

**保留（1:1 还原的玩法规则）**：节拍判定核心（note 逼近判定线、按轨道命中）；三型 note（tap/hold/double）与判定分级（Perfect/Great/Good 对应 30/20/10 分）；技能效果 4 个还原（护盾←加无敌、爆发←双重攻击、吸血←持续加血、治疗←加血）；连击/最大连击/计分。

**改动（原创改造）**：
- 主题换为「琴弦骑士」：音符马骑士、五线谱桥、弦魔；三场景包 晨曦弦桥/雨夜琴城/星海音阶。
- 操作改为「空格/点击斩击 + ↑↓/滑动换轨」（单骑士换轨），换轨成为核心决定。
- 逻辑节拍时钟 seeded 可复现（与 beat-ball 同规范，验收不依赖音频），12 关推进 + Boss 群怪。
- 新增签名瞬间「和弦斩」：连续 8 Perfect 整行五线谱震动；新增红色反击 note（必须躲）；新增技能三选一升级点（L5/8/11）；变速乐章（L6）。
- 补全：存档/埋点/广告统一走 `src/core/sdk.js`、en/zh 双语、首次交互引导、60Hz 固定步长、window.__ll 调试契约。

## 3) 门禁最终输出摘要（全部 ≥WARN）

| 门禁 | 结果 |
| --- | --- |
| `node --test` | 35 pass / 0 fail |
| `tools/selfplay.mjs` | greedy 通关到第 3 关（completed=true, levels=3），random/noinput 各死 1 次 |
| `fun-report` | **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit` | **PASS**（100/100，26 pass） |
| `verify-game` | **PASS**（60fps、0 console/page error、0 失败请求） |
| `i18n-check` | ✓ OK（en/zh 各 50 key 全对齐） |
| `tutorial-check` | ✓ PASS（3 步、可跳过、持久化、可重看） |
| `sdk-check` | ✓ PASS（SDK 就绪/降级/存档/分享全过） |
| `audio-check` | ✓ PASS（BGM 无缝循环 + 17 个 SFX 全过） |
| `vision-review` | **PASS**（readable 8.3 / silhouette 7.8 / style 8.8） |

## 4) 上线物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）
- `game.gif`（480×270，6s 循环，648KB，前 3 秒为斩击玩法）
- `SEO.txt`（TITLE/CATEGORY/TAGS/SHORT/LONG 中英双份）
- `icon.png`（256×256）、`favicon.png`（64×64）

## 5) 未做项与已知问题

- 未接真实广告账号：`config/sdk.config.js` 的 `ads.enabled=false`（符合「未接账号保持 false」）。
- 未做 AI 生成素材（BGM/角色全程序化），符合「程序化兜底」，未走 artgen 管线。
- 触屏仅支持「点=斩、滑动=换轨」，未做独立虚拟摇杆/按钮；移动端以横屏截图验收。
- 变速乐章当前为「高 BPM + 后半程视觉加速」，判定仍按逻辑时间（不影响验收与手感，仅视觉表现简化）。

## 6) 最不满意的一处

Boss（寂静魔王）目前实现为「末段一只长按蓄斩弦魔，蓄满即斩杀」，`bossHp` 只作数值门槛、未做「多次击打逐步掉血的 Boss 血条」视觉反馈；与 spec 里「每关一只 Boss 群怪 + 高血量」的「群怪围攻感」仍有差距。若续做，最优先是把 Boss 拆成末段一组高血量 tap 连打 + 独立血条，让「血量与反击」在画面上真正可读。
