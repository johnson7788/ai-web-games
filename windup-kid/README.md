# WIND-UP KID / 发条小子

2.5D 横版平台跳跃（马里奥品类）· 灰盒阶段 P0。

玩法是 2D（XY 平面、AABB × 瓦片碰撞、60Hz 定步长、无物理引擎），画面是 3D（three.js r160、透视相机 + 微俯视 + 微偏航 + 三层视差背景）。

## 运行

```bash
cd games/windup-kid
python3 -m http.server 8123
# 打开 http://127.0.0.1:8123
```

> ES Module + importmap，必须走 HTTP，`file://` 直接打开会失败。

## 操作

| 动作 | 键盘 | 触屏 |
| --- | --- | --- |
| 移动 | ← → / A D | 左下两个按钮 |
| 跳（按住更高） | 空格 / Z / ↑ / W | 右下 JUMP |
| 冲刺 | Shift / X | — |
| 火球（火焰形态） | J / F | — |
| 重开 | R | — |

调试参数：`?debug=1` 暴露 `window.__wk`（可 `__wk.go(x, y)` 传送、读 `__wk.state`）；`?lang=zh` 切中文；`?local-sdk=1` 强制本地广告 mock。

## 测试

```bash
node --test          # 自动发现 tests/*.test.mjs
```

当前 50 条断言全绿：关卡解析/校验、瓦片碰撞（落地/撞墙/子步进/单向平台）、玩家移动与跳跃（加速/滑步/可变跳/跳坑/土狼/缓冲/死亡）、相机（死区/钳制/垂直跟随）。

## 结构

```
config/
  game.config.js     手感、相机、视口参数（代码不写死数字）
  levels/level-01.js ASCII 关卡（第 0 行是最上面）
src/game/            纯逻辑：不 import three、不碰 DOM，可在 node 里跑
  level.js           ASCII → Uint8 网格 + 实体 + 校验 + lint
  physics.js         AABB × 瓦片：分轴求解 + 竖直子步进
  player.js          输入意图 → 速度/跳跃/状态机
  camera.js          死区跟随 + 前瞻 + 边界钳制
src/render/          three.js：场景/光照/瓦片合批/角色/三层视差
src/ui/ui.js         HUD 与结算
tests/               node:test
```

## 角色管线

`src/render/character.js` 是分层纸偶：**13 个平面图层**（头 / 躯干 + 双侧上臂 / 前臂 / 大腿 / 小腿 / 靴），肩、肘、髋、膝、踝都有 pivot；跑跳用「目标角度 + 指数平滑」驱动肘膝弯曲，支撑相用 2-bone IK 踩地。P11 起主角换成美工给的红帽男孩；P13 换成去马里奥化的青帽/黄衫/棕裤配色（`assets/character_v4/`，无发条钥匙，约 4.8 头身）。

贴图在 `assets/character_v4/*.webp`（4×2 拆件表 → `slice_kit.py` 自动切分），`src/render/art.js` 异步加载；**加载失败自动回退到 Canvas 占位图**。每层带 6% 深色描边 + 纸片投影，保证小视距下的剪影。

## 美术资产

| 目录 | 内容 | 来源 |
| --- | --- | --- |
| `assets/character_v4/` | 青帽/黄衫/棕裤男孩：7 部件 + 大身头/躯干 | Qwen 4×2 拆件表 + slice_kit 自动切分 |
| `assets/enemies/` | 甲虫 / 壳怪 | Qwen 出图 + rembg |
| `assets/tiles/` | 地面图集（草/土）、石台、木箱 | Qwen 出图 + 四向镜像无缝 + 调色 |
| `assets/props/` | 齿轮、草皮前缘、终点旗、检查点、弹簧、草丛/野花/石子 decal | Qwen 原生 RGBA / rembg |
| `assets/ui/` | 标题页 key art 背景 | Qwen 文生图 + 镜像 |
| `assets/backdrop_v2.jpg` | 黄昏发条工坊远景 | Qwen 文生图 2048×1024 |

生成与加工脚本在 `tools/artgen/`（`gen.py` / `build_env.py` / `build_props.py`），完整记录见 [docs/p9](../../docs/p9/README.md)。

## 现状（P8：门户接入）

已通：跑跳手感（土狼/缓冲/可变跳）、甲虫与壳怪（踩踏/缩壳/踢壳/连杀）、顶问号砖掉发条、变大/受伤降级、木箱顶碎、弹簧、受伤死亡与检查点复活、齿轮收集、旗杆结算、HUD、触屏按钮、三层视差背景、13 种程序化音效、震屏反馈。

已接：域名锁、4 个广告位（revive / doubleCoins / stageClear / gameOver 关闭）、埋点、分享卡、OG 图、海报封面与 SEO 文案。

P9 美术重制：角色拆件 + 踝关节、黄昏工坊远景、石台/草皮/道具/封面全部换新；P9.1 补地表 decal、HUD/标题 UI 换肤；P10 补木箱顶面、decal 描边、13 层肘膝摆动与踩踏 FX；P11 主角换成美工提供的红帽男孩（13 岁版）；P13 换成去马里奥化的青帽/黄衫/棕裤配色，拆件由模型出表 + 脚本自动切分。详见 [docs/p9](../../docs/p9/README.md)、[docs/p10](../../docs/p10/README.md)、[docs/p11](../../docs/p11/README.md)、[docs/p13](../../docs/p13/README.md)。

未做：死亡动画、火球拖尾、沙漠/钟楼主题贴图、木箱顶面专用贴图、真机 QA。
见 [docs/plans/2026-11-04-windup-kid-2.5d-platformer.md](../../docs/plans/2026-11-04-windup-kid-2.5d-platformer.md)。
