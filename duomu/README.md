# Seize the Log · 夺木

> 一根通天建木，两个仙人，同一节木段。
> 雷印蒙着的时候出手拿三分，但劈错边当场化灰。

**默认英文**，中文可切（`?lang=zh` 或标题页右下角）。

- 线上：<https://pipygames.com/games/seize-the-log-9sfd>
- 宣传片：<https://youtu.be/fJhGmDb-T1k>

《夺木》是把 TimberGuy（砍树躲树枝）**拆掉重做**成的双人对抗小游戏：原来的「单人躲随机数」换成了
「同一节木段上的胆小鬼博弈」。

## 直接开玩

零构建、零依赖、零网络。任选一种：

```bash
cd duomu
./start.sh            # 起服务并自动开浏览器
# 或者手动：python3 -m http.server 8127
```

然后打开 <http://127.0.0.1:8127/>。

> **不能直接双击 `index.html`。** 浏览器不允许 `file://` 加载 ES Module（CORS），
> 直接打开会看到一句提示告诉你怎么起服务——这是故意的，免得你以为游戏坏了。

## 怎么玩

每一节木段落下时，**雷印是蒙着的**。节奏分三个时间窗：

| 时间窗 | 你能看到什么 | 出手得分 | 风险 |
| --- | --- | --- | --- |
| 0 – 450ms | 什么都没有 | **×3** | 纯赌，50% 当场化灰 |
| 450 – 900ms | 一侧有微光（**七成准**） | **×2** | 信错就死 |
| 900 – 结束 | 真雷印亮起 | **×1** | 绝对安全，但慢 |

再叠一条：**同一节里第一个出手的人额外 +1**。所以「抢先」值钱，但「抢错」要命。

- 劈中雷印那一边 → 掉一格血 + 硬直
- 木段计时走完你还没出手 → 天雷只劈**你**（出过手的人不受罚）
- **双雷段**（第二劫起出现）两侧都有印，碰哪边都死，只能看它自己飘走
- 先夺到 **26 木**，或把对面三格血劈光，就赢

三劫递进：**风**（单侧印）→ **火**（加入双雷段）→ **雷**（窗口收紧 23%）。双方都拖到 64 节后进天劫，节奏再快 38%。

## 操作

| | 单人 | 双人同屏 |
| --- | --- | --- |
| 键盘 | `←` `→` 或 `A` `D` | 玩家一 `A` `D`，玩家二 `←` `→` |
| 触屏 | 点屏幕左半 / 右半 | 底部四个按钮：`◀ ▶` 各一组 |
| 暂停 | `P` / `Esc` | 同左 |

## 两种模式

- **单人 · 战电脑**：三个难度（入门 / 老手 / 宗师），反应时间、抢跑倾向、失误率各不同。电脑不作弊——它在雷印亮起前也不知道答案。
- **双人 · 同屏**：一台设备两个人，共享同一根树、同一批雷印。

## 平台接入

- `index.html` 里通过 `src/core/sdk.js` 统一出口加载 `src/vendor/pipysdk.js`（vendored，断网也能跑）
- 存档 / 埋点 / 分享 / 激励复活全部走这个出口，SDK 不可用时自动降级到 localStorage
- 激励广告位：`revive`（失败面板「看广告复活」，每次失败一次，对手已到目标木数时不给）
- 广告默认关闭（`config/sdk.config.js → ads.enabled = false`），接上广告账号后改成 `true` 即可

## 工程结构

```
duomu/
├─ index.html / styles.css
├─ config/game.config.js    ← 所有数值、劫数、配色、AI 参数（逻辑层不许写死）
├─ src/
│  ├─ game/rules.js         ← 纯规则：不碰 DOM / 时间 / 随机源
│  ├─ game/ai.js            ← 电脑对手（纯函数）
│  ├─ render/scene.js       ← 树干、角色、雷印、粒子、闪电
│  ├─ render/assets.js      ← 图片装载（缺图不白屏）
│  ├─ ui/screens.js         ← HUD / 菜单 / 说明 / 暂停 / 结算
│  ├─ core/{i18n,save,audio}.js
│  └─ main.js               ← 装配、固定步长主循环、输入
├─ assets/img/              ← 运行资源（WebP/JPG，合计 < 1 MB）
├─ docs/source-art/         ← AI 生成原图 + 概念图（不进发布包）
├─ tools/                   ← 出图、切图、截图、验收、自对弈
├─ tests/                   ← node --test 纯逻辑测试
└─ docs/
```

**关键设计**：`src/game/**` 是纯逻辑，时间由调用方传入、随机走注入的 `rng()`。所以整局对战可以在
Node 里无头跑完 —— 21 条单测和 1200 局自对弈都跑在这层上。

## 发布

```bash
./tools/package.sh                       # 打包（自动给模块 URL 加构建戳）
node tools/replace-zip.mjs ../../dist/duomu/duomu.zip --title "Seize the Log"
```

**为什么要 `package.sh`**：pipygames 的静态资源是 `Cache-Control: max-age=86400`，
直接换包后浏览器可能还会拿一天的旧 JS（踩过：底部的 LEFT/RIGHT 标签线上一直是旧的中文）。
`index.html` 本身是 `no-cache`，所以只要把入口和它 import 的每个模块 URL 都带上 `?v=<时间戳>`，
整张模块图立刻换新，不必等 CDN 过期。

## 验收

```bash
node --test "tests/*.test.mjs"   # 21 条规则单测
node tools/selfplay.mjs 400      # 三档难度各 400 局，输出胜率/局长/死因
python3 tools/verify.py          # 真点击 + 真键盘打通一局，26 项检查
python3 tools/shot.py            # 出一组截图到 tests/artifacts/
```

最近一次结果：**单测 21/21、验收 26/26、无头软件渲染 55–60fps**。
报告在 `tests/artifacts/verify-report.json`。

## 素材来源

全部图像由 `dashscope/qwen-image-3.0` 生成，逐张记录在 `assets/manifest.json`（含提示词与原始尺寸）。
加工流程见 `tools/prep-assets.py`：白底键控去背 → 裁切 → 缩放 → 转 WebP。

> 踩过的坑：`rembg` 在「大面积同色 + 细长主体」的图上会把主体本身判成背景（竖树干、玉牌都被整块抠空过），
> 这批资源改用了白底阈值键控。

字体用系统中文字体（`Noto Sans SC` / `PingFang SC` / `Microsoft YaHei`），不打包字体文件。
音频全部是 WebAudio 现场合成（噪声 + 扫频 + 衰减包络），零音频素材。

## 已知边界

- 只做桌面与移动浏览器，没做小程序 / 原生包。
- 音效只验证了「不抛异常 + AudioContext 正常」，没有做人耳主观验收。
- 双人同屏依赖同一台设备的键盘或触屏，没做联网对战。
- 无头 Chromium 是软件渲染，帧率数字偏保守；真机有 GPU 合成会更稳。

## 来源与致谢

玩法原型来自 [ubg98/TimberGuy](https://github.com/ubg98/TimberGuy)（gh-pages）。本工程保留了它的
「竖直树段 + 左右躲避」骨架，其余（双人博弈、三层时间窗、劫数、AI、美术、音频、UI）均为重写。
原始工程与本作品的关系记录在 `../砍完就下班/README.md`。
