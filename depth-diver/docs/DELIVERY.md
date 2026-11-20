# DELIVERY — depth-diver

> 改造自 `local/src1/潜水艇游戏cocos/`（Cocos 潜艇横版避障+拾取）→ 原创深海科考主题网页游戏。

## 1) 源码分析摘要（原作玩法事实）

- 状态机（`assets/scripts/GameState.ts:1-8`）：`MAIN_MENU / PAUSED / RUNNING / TUTORIAL` 四态，`CUR_STATE` 全局切换。
- 玩家操控（`assets/scripts/PlayerLogic.ts:202-234`）：拖拽沿 **X 轴水平移动**，`movementSpeed = (cursorDistance - playerDistance) * 16`（`:208`）——本质是「手指位移差 × 16」的水平跟手；碰撞后做爆炸/分数/结算（`:236-296`）。
- 障碍与拾取物沿 **Y 轴向下滚动**（`assets/scripts/ObjectMovement.ts:20-26`）：`posY -= movementSpeed * deltaTime * TIME_SCALE`，即玩家「横向躲、纵向来袭」的竖屏跑酷。
- 生成器（`assets/scripts/Spawner.ts:39-53`）：每 `spawnTimout` 生成一个障碍；每 `TIME_SCALE_TIMEOUT` 提高 `TIME_SCALE`（`TIME_PROP`）加快难度；`selectObj()`（`:55-67`）约 10% 概率在障碍旁补一个拾取物，其余只出障碍。
- 全局时间缩放（`assets/scripts/TimeProp.ts:1-5`）：`TIME_SCALE` 从 1 起步，每 2s `+0.2`。
- 两种拾取：`PickupTimer.ts:18-23`（拾取 `TIME_SCALE -= 1` 但最小 1，即「减速」）；`PickupLaser.ts:16-21`（拾取发 `LaserPickup` 事件）。
- 出屏销毁（`assets/scripts/Despawner.ts:12-14`）、爆炸自毁（`assets/scripts/Explosion.ts:4-15`）、碰撞分组（`assets/scripts/CollisionGroups.ts:1-6`）。
- **原作无「上浮/下沉」概念**：spec 的「按住上浮松开下沉」是本次改造的新增主动词。

## 2) 改造点清单

**保留（1:1 还原的玩法规则）**
- 自动前进 + 躲避障碍 + 采集加分物 + 计时/资源条 + 撞障损毁判负的核心循环。
- 难度随进行时间/深度递增（对应原 `TIME_SCALE` 递增）。
- 「减速」类拾取 → 改为 **氧气罐**（补充氧气=延长计时）；「激光」拾取 → 改为 **主动俯冲加速**（更快抵达目标省氧但更险）。
- 竖屏跑酷的「点状障碍沿纵向来袭、横向定位躲避」几何。

**原创改造**
- **主题**：深海科考潜航器下潜马里亚纳风格海沟（非军事潜艇）。
- **主动词**：按住上浮 / 松开下沉（flappy 式浮力）+ ←→ 水平微调 + 主动俯冲（3 动词，带代价）。
- **深度即分数**：越深压力越大、灯照半径越小。
- **采集 = 样本**：发光深海生物，采满 3 颗本关升星。
- **氧气 = 关计时**：12 关每关到目标深度即通关。
- **签名瞬间**：每下潜 1/3 深度换层，头灯扫开黑暗 + 生物群被惊散（`scatter` 事件 + 扫光特效）。
- **三场景包**（换章必换色板/构图/装饰）：阳光浅海 / 微光中层 / 午夜深渊。
- **12 关推进 + 10 个跨局模块**（声呐/头灯/磁吸/护盾/稳定器/俯冲/慢放/氧气罐/电池/装甲，按总星数解锁，改规则型 70%）。
- 全程序化 Canvas 美术 + 程序化 WebAudio BGM（四层、无缝循环）+ 每事件至少 1 个 SFX。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | **33 pass / 0 fail** |
| `node tools/selfplay.mjs` | greedy 到达第 3 关（lv=3）、首胜 24s、死亡存在 |
| `fun-report.mjs` | **PASS**（10 pass / 0 warn / 0 fail；首胜 24s、事件 11 种、推进 100%、死过 100%） |
| `fun-audit.mjs` | **PASS**（100/100，26 pass） |
| `verify-game.mjs` | **pass: true**（60fps、0 console error、0 失败请求） |
| `i18n-check.mjs` | **OK**（en/zh 各 37 key，0 missing） |
| `tutorial-check.mjs` | **PASS**（3 步、可跳过、持久化、可重看） |
| `sdk-check.mjs` | **pass: true**（SDK 就绪/降级/广告/埋点/存档/分享） |
| `audio-check.mjs` | **PASS**（BGM 无缝 + 15 个 SFX RMS/时长/峰值） |
| `vision-review.mjs` | **PASS**（readable 7.4 / silhouette 7.1 / style 8.6，0 critical） |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）—— 真实玩法画面 + HTML 叠字标题。
- `game.gif`（480×270、4.2s 循环、771KB）—— 真实玩法录制，前 3 秒即见「下潜采集样本 + 上浮躲避」。
- `SEO.txt` —— TITLE / CATEGORY / TAGS / SHORT DESCRIPTION / LONG DESCRIPTION，中英双份。
- `icon.png`（256×256）、`favicon.png`（48×48）—— 从游戏画面裁切。

## 5) 未做项与已知问题

- **未做**：跨平台广告账号接入（`config/sdk.config.js` 保持 `ads.enabled: false`）；排行榜/每日挑战（S 档范围外）；AI 出图素材（全程序化 Canvas 满足「美术全程序化」铁律，未引外部素材）。
- **已知问题**：`tools/record-gif.mjs` 依赖 `video.path()` 而非 `saveAs`（Playwright `saveAs` 在录制未结束时死锁，已用注释记录）；`src/core/save.js` 未保留（存档统一走 `src/core/sdk.js`，语言偏好走 i18n 的 localStorage，符合铁律）。
- **视觉**：午夜深渊场景为了 `vision-review` 的 goal_visible 达标，刻意调低了暗角强度（越深越暗的手感因此比 spec 设想的「黑底」更亮，属可读性与主题的取舍）。

## 6) 最不满意的一处

**「上浮/下沉」不是主要躲避轴**：原作几何是「横向定位、纵向来袭」，因此本作的致命躲避实际上以 **←→ 水平微调** 为主，spec 里作为招牌的「按住上浮、松开下沉」更多承担「贴样本 / 控制节奏 / 借热泉」的辅助作用，而不是玩家第一直觉里该有的「上下穿缝」。若要更贴合 spec 的浮力主控感，应把障碍改成「横向岩板留竖直缝」的 flappy 式布局，但那会偏离原作的点状障碍几何，也与「礁石/水雷/生物」的视觉语言冲突——这是我反复权衡后仍然不满意的一处。
