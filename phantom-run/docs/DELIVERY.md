# PHANTOM RUN — 交付报告

> 改造自 `local/src1/隐形人跑酷-creator/`（Cocos Creator 2D 物理平台跳跃）。本文档按 REBUILD-BRIEF §5 格式。

## 1) 源码分析摘要（原作玩法事实）

原作是一款 **Cocos Creator 2D 物理平台跳跃解谜**游戏「隐形人跑酷」，核心不是纯跑酷，而是「踩踏平台切换显隐状态」的路线规划：

- **平台状态切换（核心机制）**：`assets/script/ui/CrossControl.ts:27-33` 在 `onBeginContact` 里判断碰撞法线 `normal.y == -1`（从上方踩踏）后调用 `changeState()`；`CrossControl.ts:35-55` 里 `curState = !curState` 切换「安全↔虚化」，加载 `ui/gou`（勾）/`ui/chahao`（叉）贴图，`crossSuccessControl.passNum++/--`，并用 `setTimeout(changeTime=5000ms)` 5 秒后自动切回。
- **关卡解锁**：`assets/script/ui/CrossSuccessControl.ts:19-25` 当 `passNum == 6` 时 `door.active=false`（开门）并禁用全部 cross 控制器——踩齐 6 块符文砖过关。
- **玩家操作**：`assets/script/PlayerControl.ts:68-70` `jumpAction()` 直接设 `linearVelocity.y = jumpHeight`；`PlayerControl.ts:72-91` A/D 左右移、W 跳跃；`PlayerControl.ts:105-113` 法线 `normal.y==-1` 时 `isJump=false` 落地。
- **移动平台**：`assets/script/goods/MovePlatform.ts:13-19` 水平匀速移动、撞墙反向。
- **坠落物/尖刺/门**：`assets/script/PlaneCreator.ts:14-18` + `PlaneControl.ts:13-24` 天上掉落障碍，撞玩家重载场景判负；`assets/script/goods/FallingBlock.ts:10-19` 上方碾压判负；`assets/script/goods/ThornControl.ts:23-27` 尖刺把玩家 `resetHero(27,493)`；`assets/script/goods/DoorFall.ts:13-15` 下坠门；`assets/script/TriggerControl.ts:5-9` 按场景名切换关卡。

**一句话**：原作 = 左右移动 + 跳跃的平台解谜，核心是「踩符文砖切换平台显隐，规划踩踏顺序开机关」。

## 2) 改造点清单

**保留（1:1 还原的玩法事实）**：
- 「踩踏平台切换显隐」的核心判定（踩到 → 切状态 → 虚化可穿过下落）。
- 掉坑 / 撞障碍判负；跳跃为唯一主动操作。

**改造（从「四向平台解谜」→「一键自动跑酷」）**：
- 操作从 A/D/W 三键改成 **点击/空格单键跳跃**（自动前进），符合 spec「跑酷节奏 1 键为主」。
- 符文砖语义落地为「踩踏即虚化、revertSec 后恢复实体」，并新增 **双符文互锁**（一虚一实，踩 A 则 A 虚 B 实），对应 spec 的「双符文互锁（须踩序）」。
- 原创「**月光斑现身可穿符文墙**」机制：默认虚影撞墙判负，拾月光斑进入 ~1.6s 现身态穿过符文墙。
- 新增幽灵火追兵（屏幕内恒定落后距离）、塌陷檐（踩后 0.8s 落）、移动吊篮（竖直正弦升降）。

**原创主题与美术**：幽影城逃亡——半透明幽影从魔塔出逃；三场景包 **暮色魔塔 / 月夜街市 / 破晓城墙**（色板/构图/装饰互异，全程序化 Canvas）；签名记忆点「虚化瞬间幽影散成烟又聚回」（`runeToggle` 触发 dissolve 粒子）。音频为 A 小调四层编制程序化 BGM + 10 类 SFX。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 24 tests / 24 pass / 0 fail |
| `node tools/selfplay.mjs` | ✅ 3 策略；greedy 通关并到第 3 关（12.78s 首胜、73 apm、8 事件、0 死） |
| `fun-report.mjs --root .` | ✅ PASS（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs --root .` | ✅ PASS（100/100，26 pass / 0 warn / 0 fail） |
| `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ pass（60fps、0 console/page error、0 失败请求） |
| `i18n-check.mjs --root .` | ✅ i18n OK（en/zh 各 35 key，0 missing/0 empty） |
| `tutorial-check.mjs --root .` | ✅ tutorial PASS（visible/3 步/可跳过/持久化/可重看） |
| `sdk-check.mjs --root .` | ✅ pass（SDK 就绪/广告安全/埋点/存档/分享/降级） |
| `node tools/audio-check.mjs` | ✅ PASS（BGM 38.4s 循环无缝 + 10 SFX 全 RMS/时长/峰值达标） |
| `vision-review.mjs --root .` | ✅ PASS（readable 8.125 / silhouette 8.375 / style 9.375，0 critical） |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）
- `game.gif`（480×270、4.4s、~1.2MB，前 3 秒含捡月光斑→穿墙→跳刺→跳间隙）
- `icon.png`（256×256）、`favicon.png`（256×256）
- `SEO.txt`（中英双份，TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION 五大写关键词）
- 生成脚本：`tools/make-poster.mjs`、`tools/record-gif.mjs`、`tools/scene-shots.mjs`

## 5) 未做项与已知问题

- **未做**：幽灵火追兵目前为「恒定落后距离的可见压力」（速度与玩家一致，`_stepChase` 判负条件存在但自动跑酷下不会触发）；真正需要「抄近道」拉开距离的追兵没有做（自动跑酷没有速度控制，做快于玩家的追兵会变成必死）。
- **未做**：广告激励（复活/翻倍）未接 UI，`ads.enabled=false`（未接账号，符合验收要求）。
- **已知**：`poster.jpg` 标题叠字为 HTML 注入，未入正式 DOM（不影响上线封面生成）。

## 6) 最不满意的一处

幽灵火追兵只做到「屏幕内可见的压迫感」，没有做成真正有威胁、迫使玩家用「现身穿墙抄近道」拉开距离的机制——这本来是该游戏第 6/10/12 关「追兵段」最有辨识度的决定点，但受限于一键自动跑酷无法调速，最终退化成纯氛围。若再做一轮，会把「穿墙抄近道」做成真实的空间捷径（墙后是更短的 world-x 路段），让现身穿墙成为与追兵赛跑的胜负手。
