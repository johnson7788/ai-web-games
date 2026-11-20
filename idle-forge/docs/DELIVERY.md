# IDLE FORGE · 交付报告

> 改造自 `local/src1/天天挂机-creator/`（Cocos2d-html5 挂机游戏），原创主题「铁匠挂机铺」。
> 唯一负责 agent，端到端完成：源码分析 → 骨架 → 设计审计 → 实现 → 全套门禁 → 上线物料。

## 1) 源码分析摘要（原作玩法事实，带 文件:行号）

原作是「打怪挂机 + 装备养成」的经典放置 RPG，核心数值都在 `assets/script/Config.js`，行为在 PlayerCtrl/Home/PropCtrl：

- **数值表**（`Config.js:51-188`）：`PropList` 物品三分类（消耗/材料/装备），装备从 `5000`（新手剑 att=20）到 `5245`（盘古手 att=55）按阶递增；`Config.js:190-287` `EnemyList` 12 张图 × 每图 5 只怪（4 普通 + 1 Boss）。
- **升级/战力公式**（`PlayerCtrl.js:8-9`）：
  - 战斗力 `= (att + def) * 10 + hp * 2`
  - 升级所需经验 `= parseInt(((Math.pow(lv-1,3)+60)/5*((lv-1)*2+60)+50)/50)*50`（三次 + 线性混合，价格随等级加速）。
- **基础属性**（`PlayerCtrl.js:95`）：`att = lv*10, def = lv*5, hp = lv*100`（纯线性成长）。
- **存档**（`PlayerCtrl.js:12-16, 91`）：`GetLocalStorage/SetLocalStorage("WLGJ_PLAYER")` 直写 localStorage。
- **首登奖励**（`Home.js:7-20`）：coin 50 万 + diam 100 万 + 新手六件套。
- **道具系统**（`PropCtrl.js:7-34`）：装备掉落概率表 `prefixId 510-524`（hit 权重 400→1 递减）；`PropCtrl.js:180-189` 金币道具产出 `coin*0.5 ~ coin*1.5` 随机区间；`PropCtrl.js:191-225` 等级丹按 `interval[1000..1006]` 分档（1-99 / 100-199 / … / 600-699 级）。

**结论**：原作的核心是「数值挂机」——产出曲线指数递增、属性线性成长、经验三次方加速，配装备/道具/转盘等养成面板。改造时只保留这条数值循环骨架，主题与表现全原创。

## 2) 改造点清单

**保留（玩法规则 1:1 还原）**
- 自动产金币（原作自动打怪 → 本作自动锻造）
- 金币买升级（原作攻击/防御/血量 → 本作锤力/锤速/火温/学徒四线）
- 价格指数递增（`upgradeCost = base * 1.18^lv`）
- 离线收益（按离线时长折算，封顶 8h，50% 效率）
- 道具 buff（原作药水 → 本作炉候加温/稀有矿脉爆发）
- 点击加速手动补刀（原作手动战斗 → 本作点铁砧补锤）

**原创**
- **主题**：魔法铁匠铺——锤子自动敲打装备产金币，四线升级「锤力/锤速/火温/学徒」。
- **12 关推进**：每关攒出一件「大师之作」；装备品类铜剑→铁甲→秘银→龙鳞→屠龙圣剑。
- **关卡特异机制**：材料短缺(某线涨价 1.6×)、炉候窗口(30s 手动加温+25%)、学徒罢工(锤速减半+点击安抚)、订单限时(限时完成 ×3 奖励)、稀有矿脉(60s ×3 爆发)。
- **signature**：出传世装备全屏金光 + 低音重锤（`masterpiece` 事件 → 金色径向渐变 flash + boom 音效）。
- **三场景包**：乡村铁铺 / 城塞工坊 / 火山锻窑（色板/构图/装饰互异）。
- 全程序化 Canvas 美术 + 全程序化 WebAudio（BGM 四层 G 小调，10 类 SFX）。

## 3) 每条门禁的最终输出摘要

| 门禁 | 结果 |
| --- | --- |
| `node --test` | ✅ 29 pass / 0 fail（sim 16 + levels 10 + 另有 3 项内嵌断言） |
| `node tools/selfplay.mjs` | ✅ 3 策略：greedy 推进到第 6 关 / random 鲁棒 / noinput 自动推进到第 2 关 |
| `fun-report.mjs --root .` | ✅ **PASS**（10 pass / 0 warn / 0 fail；首输入 0s、首胜 1s、行动 327/min、空转 0%、事件间隔 0.3s、事件种类 8、推进率 100%） |
| `fun-audit.mjs --root .` | ✅ **PASS** 100/100（26 pass / 0 warn / 0 fail） |
| `verify-game.mjs --root . --plan tools/verify.plan.json` | ✅ pass（60fps、0 console/page error、0 失败请求、含移动端 844×390） |
| `i18n-check.mjs --root .` | ✅ en/zh 各 45 key，0 缺失 0 空文案 |
| `tutorial-check.mjs --root .` | ✅ PASS（3 步、可跳过、跳过/完成后刷新不再弹、可从 How to Play 重看） |
| `sdk-check.mjs --root .` | ✅ pass（SDK 就绪/降级/广告关闭安全返回 false/埋点/存档/分享） |
| `tools/audio-check.mjs` | ✅ PASS（BGM 38.4s 无缝循环 + 10 SFX ≤0.6s RMS/peak 达标 + countdown 门控） |
| `vision-review.mjs --root .` | ✅ **PASS**（readable 8.0 / silhouette 6.9 / style 8.9；无 critical） |

## 4) 物料路径

- `poster.jpg` 1280×720（标题屏 + 大标题贴纸字）
- `poster-1920.jpg` 1920×1080（同法高分辨率）
- `game.gif` 480×270 · 5.5s 循环 · 995KB（真实玩法录制：摆锤 + 金币 + 大师之作金光）
- `SEO.txt`（五关键词 TITLE/CATEGORY/TAGS/SHORT/LONG，中英双份）
- `icon.png` 256×256 · `favicon.png` 32×32（从玩法画面裁切装备立绘）

## 5) 未做项与已知问题

- 广告未接账号：`sdk.config.js` 的 `ads.enabled = false`（符合「未接账号保持 false」规范），广告 UI 不出现、`showRewarded` 安全返回 false。
- 未做 ja/ko/ar/ru 多语言（只暴露 en/zh，整块不暴露半成品）。
- 美术全程序化 Canvas（未走 AI 出图），符合 brief「美术全程序化 Canvas」的硬约束。
- 已知平衡点：手动敲击收益偏强（0.3s 一次补锤 ≈ 一次锻造），与自动挂机形成「点击加速」但会让 bot 通关偏快——这是刻意保留的「手动补刀」手感，非 bug。

## 6) 最不满意的一处

**四线升级的「效果差异化」仍偏数值**：锤力/锤速/火温/学徒本质都是「产量乘子」的不同切片（单次产量 / 频率 / 进度 / 被动收入），玩家很难在「现在点哪条」上做出有信息差的取舍——设计审计靠 5 条 `rule` 升级（短缺/炉候/矿脉/罢工/订单）把「规则变化」顶到了 56%，但关卡内的四线点击依然更接近「哪个便宜点哪个」。若重做，我会把其中两条线改成真正改变行为（例如「火温」攒满后触发一次可手动释放的爆发、「学徒」解锁自动收集与自动点铁砧），让四线不是同一根曲线上的四个旋钮。
