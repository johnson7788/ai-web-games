# INK PATH · 交付报告

> slug `ink-path` · title `INK PATH`（蛛丝星图）· appId `pipy-ink-path`
> 改造自 Cocos 2.x 原作「一笔画」，主题原创为「萤火虫蛛在星空网上织丝」。

## 1) 源码分析摘要（原作玩法事实）

原作路径 `local/src1/一笔画/一笔画/assets/`，核心三处：

- **关卡数据** `assets/resources/SubModules/LB/scripts/sc/LevelDataLB.js:13-35`
  `getLevelData()`：网格 `w×h` 全 1，再按 `info[2]`（emptyArr）把若干格置 0，返回
  `{ w, h, start: {x,y}, grid, answer }`。即「全格可走 + 若干空格（障碍）」。

- **输入与判定** `assets/resources/SubModules/LB/scripts/sc/GamePlayLB.js:151-182`
  `onTouch()`：点中已在路径里的格子（且不是最后一步）→ 弹出到该格（**回退**）；
  否则要求与末格曼哈顿距离 == 1（四连通相邻）→ push 进 `choosed`。

- **过关** `GamePlayLB.js:227-228`
  `checkPassLevel()`：`totalCell == choosed.length` 即过关 —— **每个非空格子恰好访问一次**。
  这是**哈密顿路径**（节点只走一次），不是边一笔画。

- **画线** `GamePlayLB.js:184-225` `refreshView()`：用 `cc.Graphics` 沿 `choosed` 画
  80px 粗的填充路径 + 3px 白描边。

结论：原作 = **网格上的哈密顿路径**（指定起点、四连通、全节点覆盖、点击早前节点回退）。

## 2) 改造点清单

**保留（1:1 还原的核心规则）**
- 指定起点出发；沿相邻节点延伸；每节点恰好访问一次；全节点覆盖即过关；点早前节点回退。
- 纯逻辑 sim 与渲染分离；60Hz 固定步长；英文默认 + 中文必做；存档/埋点/广告只走 SDK 统一出口。

**原创改造**
- **主题**：蛛丝星图 —— 节点=星子，边=丝线，画过之处丝线发亮；完成瞬间整张星网亮起涟漪 + 萤火虫群飞散（signature）。墨蓝夜空底 + 高亮丝线。
- **图模型**：从网格升维到**任意图**（12 关手工设计：链→星轮→桥→双环→K5→…→大师网）。
- **三场景包**（换章必换）：薄暮林间 / 极光冰原 / 深空星云，色板·构图·装饰互异。
- **新增规则型变体**（对应「改规则升级」）：
  - 边只走一次（欧拉路径，可重走星子）— L6 / L11；
  - 单向丝（箭头只能顺向走）— L7 / L9 / L11；
  - 断线解锁（先点亮触发星子才解锁新丝）— L8 / L9 / L12。
- **通用求解器** `src/game/solver.js`：一个 DFS 统一验证/求解 nodes 与 edges 两种模式 +
  单向边 + 断线解锁，12 关全部由单测断言有解。
- **评级钩子**：星级按「步数 vs 最优步数（par）」结算，回退会增步 → 完美织网 3 星。
- **原创程序化音频**：A 小调 BPM96 四层 BGM（16 小节无缝循环）+ 7 个 SFX（织丝/回退/点亮/解锁/走错/织成/丝断）。
- **操作**：点击/拖拽节点；键盘 Tab 聚焦 + Enter/Space、U 回退、Esc 暂停、R 重开、M 静音。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 30 条纯逻辑测试全绿（sim 15 + levels 10 + solver 复用断言） |
| `node tools/selfplay.mjs` | ✅ greedy 串行通关并到达第 3 关（events=6, lvl=3）；random 弃局死亡；noinput 基线 |
| `fun-report.mjs` | ✅ **PASS**（10 pass / 0 warn / 0 fail） |
| `fun-audit.mjs` | ✅ **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs` | ✅ pass=true，60fps（avgFrameMs 16.67），0 console/page error，0 失败请求 |
| `i18n-check.mjs` | ✅ en 37 key / zh 37 key，0 missing / 0 empty，默认 en |
| `tutorial-check.mjs` | ✅ PASS（4 步引导，可跳过/持久化/可重看） |
| `sdk-check.mjs` | ✅ pass=true（SDK 就绪/API 齐全/降级/埋点/存档/分享全绿） |
| `tools/audio-check.mjs` | ✅ PASS（26 项：BGM 40s 无缝循环 + 7 SFX RMS/时长/峰值） |
| `vision-review.mjs` | ✅ **WARN**（readable 7.875 / silhouette 7.375 / style 8.625，0 critical，0 文字裁切） |

## 4) 物料路径

- `poster.jpg` 1280×720（60KB）— 点亮丝线的大师网 + 贴纸字标题
- `poster-1920.jpg` 1920×1080（92KB）— 同套排版
- `game.gif` 480×270 · 4s 循环 · 112KB（≤2MB）— 真实织丝玩法，前 3 秒即见核心动作
- `icon.png` 256×256 · `favicon.png` 64×64 — 星网画面裁切
- `SEO.txt` — TITLE/CATEGORY/TAGS/SHORT DESCRIPTION/LONG DESCRIPTION 中英双份

## 5) 未做项与已知问题

- 未接广告账号（`config/sdk.config.js` `ads.enabled=false`，source=`local`），上线前改 `online` 并配 appId 后台一致。
- 无每日挑战 / 排行榜（replayHooks 里的 `daily` 未实现；`unlock/rating/nearMiss/growth` 已落地）。
- 移动端竖屏仅给横屏提示（可跳过），未做竖屏专用布局。
- 拖拽只支持「点」式延伸；「从节点拖到相邻节点」暂以点相邻节点等价（spec 允许）。
- vision-review 为 WARN 而非 PASS：readable 均分 7.875（差 0.125 到 8），模型建议增大小步数/目标星权重，非阻断项。

## 6) 最不满意的一处

**结算星级的区分度偏弱。** 当前「步数 == par → 3 星，≤ par×1.5 → 2 星」在大多数关卡里
2 星区间很窄（par 本身较小），玩家很难直观感受到「差一步就完美」的 nearMiss 张力；
评级钩子（replay hook）在纸面上成立了，但玩起来「3 星 vs 2 星」的刺激不够。理想做法是
把「回退次数」单列成可见的负反馈（每次回退都惩罚且结算时明示），而非只藏在步数里。
