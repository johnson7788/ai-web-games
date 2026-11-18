# Oasis Pipeworks · M2 执行单：渲染 + UI（Canvas 场景/管件/水流 + 屏幕与 HUD）

> 前置：契约见 `docs/README.md`（唯一真相，动手前先读 §3 与 §5）。M1 的 sim 未交付时可先用本地 mock（契约 §3.4 的 state 形状），交付后我接线。
> 只改：`src/render/index.js`、`src/ui/ui.js`、`styles.css`。
> 禁改：`src/main.js`、`index.html`、`src/game/*`、`src/core/*`、`config/*`。

## 0. 完成定义（可验收）

- 骨架页面能跑：`python3 -m http.server 8124` + 浏览器 0 console error。
- `node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/artifacts/r-title.png` 能出图，标题屏是「绿洲水工」成品观感（非骨架灰屏）。
- 三个场景包（dawn-desert / dusk-canyon / night-oasis）在 mock 数据下各出一张截图，一眼可分。

## 1. 硬约束

- 零运行期依赖：无 CDN/外链/字体；素材全部程序化 canvas 绘制（本作美术 = 代码绘制，见 §3）。
- 逻辑世界 1280×720 + letterbox；DPR 处理保留骨架做法。
- 渲染只消费 `run.state`（契约 §3.4）+ 事件副作用（cellWatered 时该格水色泛光 0.4s）。
- UI 屏幕用 DOM+CSS（骨架已有 title/pause 屏结构可扩展），语言切换/存档逻辑在 `src/core/i18n.js`+`save.js`（Lead 拥有，不要改；`ui.js` 只调它们的现有 API）。

## 2. 交付物

- `src/render/index.js`（≤800 行）：
  - `createRenderer(canvas)` → `{ draw(state, dt, view) }`；`view = { hoverCell, selectedPiece, cursor, fxQueue, sceneKey }` 由 main 传入。
  - 绘制层次：背景场景包（沙丘/岩层/星空，3 套切换）→ 网格底板（龟裂地纹）→ 岩石格（圆石+阴影）→ 花朵格（花苞→开花两态）→ 管件（陶土管，见 §3）→ 水流（路径折线+水头高光+灌满格水色）→ 等待区（右列，件下落 offsetT 缓动）→ 入水/出水箭头 → 小狐狸（idle/抓管/欢呼三态，程序化）。
  - 管型 7 种（E/N/UL/UR/LL/LR/X）造型函数；`watered` 格管内充水。
- `src/ui/ui.js`：`ui` 对象扩展为 `{ lang, t(key), setMuted, show(screen), hide, updateHud(hud), bindLevelSelect(...), lang 相关回调 }` —— 以骨架现有 API 为基线扩展，不破坏 main.js 现有调用（main 会重写，但保持同名 API 最重要：`t/setMuted/show/hide/updateHud`）。
  - 屏幕清单：title / levelSelect（12 格星级，锁灰）/ pause / result(won/lost：星级大图标、花计数、按钮 Retry/Next/Double)/ tutorial 高亮钩子容器（`ui.tutorial = { step, spotlight(rect) , next(), skip() }` 供 main 驱动）。
- `styles.css`：糖果感按钮（渐变+硬投影 0 6px 0、白色图标贴片、圆角=高×0.25）、顶部黑条 HUD、贴纸风标题字（黄橙渐变+紫描边）；`prefers-reduced-motion` 关闭大幅动效。

## 3. 美术规格（全程序化）

- **陶土管**：外管 #A0522D→#8B4513 渐变，端口法兰环（亮 #D2691E 环 + 暗边），内腔 #3B2412，高光斜环带（alpha 0.25 白）。弯管圆弧半径 = CELL/2。X 管 = E+N 双层交叠（下层暗 10%）。
- **水**：#7FD8E8 alpha 0.85，水头 6px 白高光点 + 3px 尾迹渐隐；灌满格整管内腔换水色并加 0.4s 泛光。
- **场景包**（色板与构图必须互异）：见契约 §5。背景绘制 ≤3 层（远山剪影 1 层 + 地面纹理 1 层 + 光效 1 层），每帧绘制预算 ≤6ms（用离屏 canvas 缓存静态层，只重绘动态层）。
- **小狐狸**：canvas 程序化（圆头三角耳/尖吻/大尾，≤25 个图元），放网格左下角 96×96；状态：idle（呼吸 3px + 尾摆）/carry（耳竖+头顶管件图标）/cheer（跳 8px，win 时）。
- **HUD**：顶部 44px 通栏半透明黑条：左关卡名、右时间胶囊 + 花 🌸×n 计数 + 铲除按钮（圆形，徽标次数）。按钮 ≥44px 触区。
- **移动端**：844×390 视口下网格居中缩小、等待区贴右、HUD 不遮网格（用断言：网格 bbox 与 HUD 矩形不相交，写进 render 的 debug 输出 `renderer.debugLayout()` → { grid, hud, queue } 供验收脚本）。

## 4. 契约

消费 `docs/README.md` §3.4 state / §3.5 事件副作用；不依赖 sim 内部私有字段。
`createRenderer(canvas)` 返回 `{ draw, debugLayout, resize }`；`resize(w,h)` 处理 letterbox。

## 5. 验收命令（自己跑并贴输出）

```bash
cd games/oasis-pipeworks
python3 -m http.server 8124 &   # 截图脚本自带服务，可不起常驻
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/artifacts/r-title.png
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --url "http://localhost:8124/#render-demo" --out tests/artifacts/r-scene2.png 2>/dev/null || true
```
（render-demo：在 index.html 不许动的情况下，把三个场景包截图入口做成 `render/index.js` 里 `window.__renderDemo(sceneKey)` 调试函数，shot 脚本调 `page.evaluate` 执行后截图——如果 shot.mjs 不支持 evaluate，就写 `tools/scene-shots.mjs` 自带 playwright 截三张。）

## 6. 优先级

- P0：管件+网格+水流+HUD+三场景包+标题屏成品观感
- P1：狐狸/花田/箭头/结果屏
- P2：844×390 断言与动效打磨

## 7. 交付格式

1) 文件清单 2) 截图路径（title + 3 场景 + playing） 3) 未做项 4) 最不满意的一处
