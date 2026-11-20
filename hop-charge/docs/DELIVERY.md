# HOP CHARGE 交付说明

> slug `hop-charge` · title `HOP CHARGE` · appId `pipy-hop-charge`
> 改造自 Cocos 跳一跳（`local/src1/跳一跳源码cocos/跳一跳资源源码/learn_jump_1/assets/resources/scripts/`）

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

| 事实 | 出处 |
| --- | --- |
| 全局状态机：0 没开始 / 1 游戏中 / 2 按下 / 3 弹起 / 4 结束 | `GameData.ts:9-10` |
| 触控按下：状态置 2、重置蓄力时间、播放起始音 | `LogicCtl.ts:51-62` |
| 触控松开：状态置 3、恢复英雄/箱子形变、按目标箱子起跳 | `LogicCtl.ts:69-147` |
| 蓄力帧计数：`touch_time++`，每帧把英雄压成矮胖、箱子压扁 | `LogicCtl.ts:200-211` |
| 英雄压缩：scaleY 降到 0.8、scaleX 涨到 1.2（蓄力力度可视） | `HeroCtl.ts:69-88` |
| 起跳距离 = 蓄力时间 × 8，方向取「目标箱子 jump_point − 英雄位置」归一化 | `HeroCtl.ts:105-117` |
| 抛物线跳跃：`jump_to(高度 200, 时长 0.4)`，quadOut/quadIn 两段 | `JumpTo.ts:5-70` |
| 落点判定（碰撞体 tag）：中心撞中心=2(完美)、中心撞边缘=1(普通)、边缘撞边缘=-1(滑倒)、无碰撞=0(踏空) | `HeroColliderCtl.ts:28-41` |
| 计分连击：2 分时 `step_score = step_score*2`（1,2,4,8…），0/-1 清零 | `GameData.ts:46-65` |
| 下一箱生成：取末两箱方向归一化、随机距离 300–450、随机翻转方向 | `LogicCtl.ts:154-168` |
| 初始两箱坐标 (-133,-207) 与 (169,-44) | `LogicCtl.ts:246-248` |
| 屏幕跟随：移动到末两箱中点（朝灯塔参考点） | `LogicCtl.ts:174-193` |
| 结算：分数 >0 继续并产生新箱，≤0 弹出结束面板 | `LogicCtl.ts:113-132` |

## 2) 改造点清单

**保留（P0 还原，玩法规则 1:1）**
- 按住蓄力 → 角色压缩 + 蓄力条（力度可视）。
- 松开起跳 → 抛物线飞行 → 落点判定：中心=完美 / 台面=普通 / 边缘=失足坠落。
- 完美落点连击翻倍（1,2,4,8…），普通落点连击清零。
- 下一平台距离按规则生成 + 相机跟随。

**原创改造（主题 / 内容 / 系统）**
- **风灯跳塔主题**：提灯小狸猫在夜色屋顶间跳跃，蓄力时灯焰随力度涨大；完美落点灯焰炸出光环（signature），连击时尾巴着火拖尾。
- **三场景包**（换章必换，色板/构图/装饰互异）：暮色瓦镇（暖橙晚霞 + 瓦屋剪影）→ 雨夜灯笼街（深蓝雨夜 + 雨丝 + 月亮）→ 晨雾山顶（青白晨雾 + 山峦 + 雾带）。
- **12 关推进**（每关一个新元素）：固定间距 → 渐远 → 渐近 → 移动台（左右缓动）→ 弹簧台（弹更远有横偏）→ 冰面台（落点滑半格）→ 断头台（边缘更窄）→ 逆风段（阻力）→ 综合 ×4 大师关。
- **三星评级**：通关 +1、最大连击 ≥4 再加 1、全程无普通落点再加 1。
- **程序化 WebAudio**：BGM 五声音阶四层编制无缝循环 + 15 个事件音效（含灯焰、光环、连击、弹簧、冰滑）。
- 全原创美术（Canvas 程序化），无任何外部素材/角色/音乐。

## 3) 每条门禁最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | 28 tests / 28 pass / 0 fail |
| `node tools/selfplay.mjs` | greedy 串行打到第 3 关（dur 15.68s / firstSuccess 3.95s / 22 actions / 8 类事件）；random 0.88s 坠落死亡；noinput 40s 超时死亡 |
| `fun-report.mjs` | **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | **PASS**（100/100，26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | **pass: true**（60fps，avgFrameMs 16.66，0 console/page error，0 失败请求） |
| `i18n-check.mjs` | ✓ i18n OK（en/zh 各 39 key，0 missing / 0 empty） |
| `tutorial-check.mjs` | ✓ tutorial PASS（4 步 / 可跳过 / 跳过持久化 / 可重看） |
| `sdk-check.mjs` | **pass: true**（SDK 就绪 / 降级 / 广告关闭安全返回 / 埋点 / 存档 / 断网降级） |
| `tools/audio-check.mjs` | PASS（BGM 循环 38.4s 无缝 + 14 类 SFX RMS/时长/峰值全过） |
| `vision-review.mjs` | **PASS**（readable 8.1 / silhouette 7.7 / style 9.0，0 critical） |

## 4) 物料路径

| 物料 | 路径 | 说明 |
| --- | --- | --- |
| 海报 1280×720 | `poster.jpg` | 真实标题画面 + 大标题叠字 |
| 海报 1920×1080 | `poster-1920.jpg` | 同套排版放大 |
| 列表页动画 | `game.gif` | 480×270 / 4s / 546KB，前 3 秒即见蓄力+起跳+落点 |
| SEO | `SEO.txt` | 五个大写关键词 TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION，中英双份 |
| 图标 | `icon.png` 256×256 | 提灯小狸猫 |
| favicon | `favicon.png` 32×32 | 图标缩放 |

物料生成脚本：`tools/make-media.mjs`（poster/icon）、`tools/record-gif.mjs`（录 webm）→ ffmpeg 转 `game.gif`。

## 5) 未做项与已知问题

- 竖屏旋转提示仅静态元素，未接横竖屏实时检测（桌面/横屏验收无影响）。
- `prefers-reduced-motion` 未单独做降级（震屏幅度本身很小，仅 2–6px）。
- 广告位 `stageClear`/`gameOver` 已配但 `ads.enabled=false`（未接广告账号），按配置不展示广告 UI。
- 复活动画/分享按钮未做（广告关闭状态下无入口）。

## 6) 最不满意的一处

**落点判定与视觉的「中心」不完全对齐**：逻辑判定用「落点世界 x 与平台中心 x 的横向偏移」，但画面里的「中心发光靶心」画在平台顶面的椭圆上，两者语义一致但视觉上椭圆是透视压缩的，玩家第一眼会把「靶心」当成要瞄准的绝对位置，而不是「横向偏移 ≤ 阈值」的判定带。理想做法是加一条从角色到落点的虚线轨迹引导，把「力度→落点」的映射显式化。
