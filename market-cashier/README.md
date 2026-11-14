# MARKET CASHIER · 超市收银

> 三个班次、每天五位顾客。扫码 → 算总价 → 用纸币/硬币凑出**精确找零**，在耐心耗尽前交付。
> 找对得分 + 速度小费 + 连击；找错 / 顾客走人扣分。班间三选一升级，撑完三天拿评级。

**已上线：** https://pipygames.com/games/market-cashier-exact-change-supermarket-sim-hhiw  
**线上直链：** https://pipygames.com/g/g_1794628159053_2rhhiw/index.html

- 品类：模拟 / 休闲（收银 / 找零 / 心算）
- 参考：超市收银 / 找零类小游戏（只借鉴品类，规则、代码、美术全部原创）
- 技术：零构建纯静态 · ES Module · Canvas 场景 + DOM 面板 · 1280×720 letterbox · 程序化 WebAudio · 60Hz 定步长
- 规模：3 天 × 5 位顾客 · 8 个升级 · 3 种顾客 · 整钞顾客 · 连击倍率 · S/A/B/C 评级
- 首次进入：4 步交互引导（高亮真实商品/纸币/交付按钮，可跳过、可重看、同一页面/刷新只自动弹一次）

## 运行

```bash
cd games/market-cashier
python3 -m http.server 8124
# 浏览器打开 http://localhost:8124
```

`?lang=zh` 切中文；默认英文。

## 操作

- 鼠标 / 触屏：点商品扫码；点面额按钮累加找零；`GIVE CHANGE` 交付，`RESET` 清空。
- 键盘：`1–5` 扫对应商品，`Enter` 交付，`R` 清零，`Esc`/`P` 暂停。
- 所有按钮都有 focus 可见；`prefers-reduced-motion` 下关闭大幅动画。

## 规则

- 每单 2–6 件商品（按顾客类型），价格以**分**为单位累加。
- 付款：普通顾客向上取整到 $10（恰好整额多付 $10）；**整钞顾客**付正好金额，找零 $0。
- 找零必须**恰好等于**应找金额：+100 基础分 + 按剩余耐心的小费（最高 $0.50，升级后 $0.75）。
- 连击：连续成交倍率 ×1.0 → ×1.15 → ×1.30 …（升级后最高 ×6）；找错/顾客走人清零。
- 找错 −30 并让顾客耐心 −3s；耐心耗尽顾客走人 −50 并换人。
- 每天 5 位顾客，本班得分 ≥ 目标才过关；过关三选一升级，再进下一天。
- 3 天通关按总分评级：S ≥3600 / A ≥3000 / B ≥2200 / C。
- 三种顾客：常客（标准）、赶时间（耐心 ×0.7、小费 ×1.5）、大采购（商品更多、耐心 ×1.15）。
- 8 个升级：快手 / 大方小费 / 耐心顾客 / 连击大师 / 硬币直觉 / 整钞奖励 / 快速通道 / 会员卡。

## 测试与验收

```bash
cd games/market-cashier
node --test                                                   # 19 条纯逻辑测试
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/artifacts
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/asset-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/final

# Auto Gate（新 playbook）
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .     # 需要 tools/fun/autoplay.json
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

本轮实测：

- `node --test`：19/19 通过。
- `verify-game`：全部断言通过，60fps（avgFrameMs 16.67），0 console/page error。
- `i18n-check`：en/zh 各 134 key，0 缺失。
- `sdk-check`：SDK 就绪 / 广告关闭 / 埋点 / 存档 / 分享 / 域名拦截降级全部通过。
- `fun-audit`：PASS 100/100。
- `fun-report`：PASS（greedy 2 次 3 天通关；random/noinput 作基线）。
- `vision-review`：PASS，均分 readable 8.8 / silhouette 6.9 / style 8.4（8 张，含引导首屏）。
- `tutorial-check`：PASS（4 步、可跳过、刷新不再弹、可重看）。

## 首次交互引导

第一次点 Start 不弹说明书，而是进入 4 步引导：

1. 高亮第一件商品，要求真的点它扫码；
2. 扫完篮子，看到阶段切到找零；
3. 高亮 $5.00 纸币，要求凑出正好找零；
4. 高亮 Give Change，完成第一单。

引导可跳过；跳过/完成后写 `tutorialDone`，刷新不再自动弹；标题和暂停都有 “How to play” 可重看。`tests/final/tutorial-report.json` 是门禁证据。

## 上线状态

- 已发布到 Pipygames 后台，详情页与直链均可打开。
- 线上复验：`desktop` 进入 `playing`、`hud=true`；`iphone` 竖屏 `rotate=flex`、横屏 `rotate=none`；0 游戏 console/page error。
- 线上引导：新包首次 Start 出现 4 步引导；跳过/完成后刷新不再自动弹；站点 iframe 是 sandbox，localStorage 不可用时用 URL hash 兜底（新开页面仍视为新玩家，可跳过）。
- 线上证据：[online-verify.json](tests/final/online-verify.json) · [online-tutorial.json](tests/final/online-tutorial.json) · [online-tutorial.png](tests/final/online-tutorial.png) · [online-mobile.png](tests/final/online-mobile.png)。
- 打包产物：`dist/market-cashier/market-cashier.zip`（0.68 MB，根目录 index.html）。

## Auto Gate 说明

`tools/autoplay.mjs` 用 Playwright 真实点击跑三条策略：

- `greedy`：扫码 → 精确找零 → 交付 → 三选一升级，直到通关；
- `random`：随机扫码/点钱/交付，验证边界；
- `noinput`：不做操作，验证耐心/失败/基线。

```bash
node tools/autoplay.mjs        # → tools/fun/autoplay.json
```

## 目录

```
config/       game.config（数值/天数/评级）/ customers / upgrades / products / locales / design.json / sdk.config
src/game/     sim.js（纯逻辑：扫码/找零/耐心/连击/班次/升级）
src/render/   index.js（Canvas：超市墙面/货架/收银台/顾客）
src/ui/       ui.js（HUD/商品/小票/钱箱/班次结算/结局）
src/core/     i18n / save / sdk
tests/        sim.test.mjs + final/（验收截图）+ artifacts/（过程截图）
tools/        autoplay.mjs / verify.plan.json / fun/（Auto Gate 报告）
```

## 调试契约 `window.__ll`

```js
__ll.state.phase        // title / playing / paused / day / ending
__ll.start/pause/resume/restart
__ll.debug.state()      // getHud：phase/day/score/target/combo/patience/items/total/change/...
__ll.debug.scanAll()    // 扫完当前顾客
__ll.debug.serveCorrect() // 扫码 + 精确找零 + 交付
__ll.debug.advance(sec) // 快进模拟（测试用）
__ll.telemetry(policy)  // Auto Gate 遥测
```
