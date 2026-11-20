# BEAT BALL · 交付说明

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

原作 `local/src1/3d音乐球2.4.11/` 是 Cocos 2.4 的「音球」跑酷：球沿纵深轨道前进，撞色球得分、撞错色判负、吃金币、跑到终点。核心事实：

- **pow2 深度透视**：`Demo.ts:30` `prop.node.y = -382 * Math.pow(2, prop.scale/100)`，`Demo.ts:59` `scale += 2.5*ddt`，`Demo.ts:45-57` scale 到 -400 时回卷。这就是「纵深越近越大越低」的伪 3D 曲线。
- **玩家横移**：`Layer_0.ts:143` `movepos = e.getDelta().x*1.4 + myqiu.x`，`Layer_0.ts:338-340` 夹在 [-200,200]。
- **障碍生成**：`Layer_0.ts:210-246` `direnqiufun` 从歌曲 JSON 的 `mStartSample` 生成障碍；`direnqiu.ts:54` `scale = (-tim*60/pinlv)*chazhi` 用采样时间换算初始深度，`chazhi=2.55`（`direnqiu.ts:31`）。
- **轨道（lane）计算**：`direnqiu.ts:71-91` `jisuanshuzu(num)`，`dage=340`，偶/奇分档求轨道 x 偏移。
- **障碍类型**：`direnqiu.ts:94-172` `sucaitypefun`——1-4 彩球（撞对色得分）、11-44 左右游走彩球、101-104 变色地板（`direnqiu.ts:245-248` `setmyqiu(this.ID-3)`）、201 金币、401 终点。
- **判定**：`direnqiu.ts:207-271` `pengzhuang()`——深度接近 + x 距离小于 `kuandu` 即碰撞；撞错色 → `gameEnd(0)` 判负（`Layer_0.ts:343-370`），撞对色 → `setbiaoyang` 连击计分（`Layer_0.ts:274-291`），金币 → 收集 +1，401 → `gameEnd(1)` 过关。

## 2) 改造点清单

**保留（P0 还原）**：pow2 纵深透视曲线（换汤不换药，`src/render/index.js` 的 `eventScreen` 用 `Math.pow(2, approach*4-4)` 复刻指数加速）；纵深前进 + 撞障碍判负；随节拍生成障碍密度；距离即分。

**原创主题「鼓面疾行」**：障碍变成**鼓槌落点**（红圈预警 → 节拍到达时鼓槌落下），太鼓球踩中**发光节拍点**时鼓面泛涟漪 + 太鼓音采样，连踩 Perfect 加分。

**原创改造点**：
- 障碍生成从「读歌曲 JSON」改为**逻辑节拍时钟**（`src/game/sim.js` `beatTimes` + seeded `mulberry32`），验收脚本关 WebAudio 也完全可玩可测。
- 三场景包（换章换色板/构图/装饰）：晨光祭道 / 灯笼夜祭 / 雷雨祭台（`src/render/index.js` 的 `SCENES` + `drawBackground`）。
- 12 关推进结构（`config/levels.js`）：单轨→双轨→三轨→鼓槌预警→双槌交替→跳板段→变速段→迷雾段→鼓点连击→左右开弓→雷雨加速→双鼓对撞。
- 判定从「撞色」改为「抢拍/让拍」取舍：节拍点踩中加分 + 连击，跳板节拍点需滞空踩中（双倍分），普通节拍点滞空会断连击。
- 操作：←→ 变道 / 空格跳跃；触屏滑动 + 屏幕按钮。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 | 关键观测 |
| --- | --- | --- |
| `node --test` | ✅ 30 pass / 0 fail | sim + levels 纯逻辑 |
| `tools/selfplay.mjs` | ✅ | greedy 通关 L1→L3（completed=true, levelsReached=3, firstSuccess=26.68s） |
| `fun-report` | ✅ PASS | 10/0/0；首输入 4s、首胜 27s、行动 123/min、事件 12 种、推进率 100%、死亡 67% |
| `fun-audit` | ✅ PASS | 100/100，26 pass |
| `verify-game` | ✅ PASS | 60fps（avgFrameMs 16.67）、0 console/page error |
| `i18n-check` | ✅ OK | en/zh 各 38 key，0 missing/empty |
| `tutorial-check` | ✅ PASS | visible/active/skip/persist/replay 全过 |
| `sdk-check` | ✅ PASS | SDK 降级可玩、广告关闭返回 false、埋点/存档/分享出口齐全 |
| `audio-check` | ✅ PASS | BGM 循环 34.3s 无缝 + 13 条 SFX 全过 |
| `vision-review` | ⚠️ WARN | readable 7.9 / silhouette 7.9 / style 9.0（≥WARN 达标） |

## 4) 物料路径

- `poster.jpg`（1280×720）、`poster-1920.jpg`（1920×1080）——真实三轨玩法画面 + HTML 叠字「BEAT BALL」。
- `game.gif`（480×270、~1.1MB、6s 循环）——真实玩法录制（鼓面疾行躲槌/踩拍），前 3 秒即为核心动作。
- `SEO.txt`——TITLE / CATEGORY / TAGS / SHORT DESCRIPTION / LONG DESCRIPTION，中英双份。
- `icon.png`（256×256）、`favicon.png`（64×64）——从玩法画面裁切太鼓球。

## 5) 未做项与已知问题

- 未接真实广告账号（`sdk.config.js` `ads.enabled=false`，符合「未接账号保持 false」约定）。
- 竖屏旋转提示已做（触屏 + 竖屏才显示），未做复杂无障碍（Tab 走完菜单/色盲冗余），属 S 档取舍。
- BGM 恒定 112 BPM（太鼓祭典），关内节拍时钟按关卡 BPM 90–140 走；BGM 未逐关变速（brief 只要求 sim 内逻辑节拍锁定，未硬性要求 BGM 变速）。
- `vision-review` 为 WARN 而非 PASS：主要扣分点是 HUD 图标按钮无文字标签、标题屏星星计数偏小、进度条在深色场景对比度一般——均为可读性小项，不影响目标可见/无遮挡/无裁切。

## 6) 最不满意的一处

渲染的「太鼓面」是用椭圆 + 径向渐变近似画出来的，鼓皮质感（真太鼓的木纹、蒙皮反光、铆钉阴影）还不够像；在 `vision-review` 里没被扣分，但离「一眼就是太鼓」还差一口气。理想做法是 AI 出一张太鼓面贴图做底，程序化只画轨道/特效，本迭代为守住「零外链 + 纯程序化」选择了全 Canvas 近似。
