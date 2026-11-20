# STAR SWAP

> 星屑三消 · 深空观测站（改造自 creator 星星消消乐，玩法规则原创为交换三消）

## 运行

```bash
cd games/star-swap
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（唯一例外站点 SDK，断网自动降级）。

## 一句话

在深空观测站里交换望远镜中的星屑，相邻交换成三连即消除；四连/五连锻造特殊星，透镜隔空换位，清到目标分过关。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 交换相邻星 | 点击/点触一颗星再点相邻星 |
| 引力透镜隔空换位 | 点右下角透镜按钮 → 点任意两颗星 |
| 暂停 / 继续 | Esc / P |
| 失败重来 | R |
| 开始 / 下一关 | Enter |

## 乐趣假设与验证

- **乐趣假设**：玩家第 3 分钟还想继续，是因为「稳三连 vs 蓄四连/五连」的取舍 + 引力透镜的资源分配，让每一关都不是机械点击。
- **验证**：`fun-audit` 100/100（26 项全过）；`fun-report` PASS（greedy 推进到第 8+ 关、事件 17 种、空转 0）；`vision-review` PASS（readable 8.8 / silhouette 7.8）。
- **签名记忆点**：五连「超新星」——全屏白闪、同色星屑全部湮灭。

## 反范围（不做）

- 不做联网/排行榜
- 不做皮肤商店
- 不做每日任务
- 不做剧情对话
- 不做竖屏专属模式（横竖 letterbox 兼容即可）

## 设计源

- `config/design.json`：机器可读设计源（动词/决定/关卡/升级/钩子）
- `config/gameplay.js`：三消数值
- `config/levels.js`：12 关推进 + 3 场景包
- `docs/analysis.md`：源码分析（含「源码是 tap-to-pop、spec 重定义为 swap-match3」的差异说明）

## 门禁

```bash
node --test                                          # 25 条纯逻辑测试
node tools/selfplay.mjs                              # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root . --out tests/final
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 目录

```
config/          数值 / 关卡 / 文案 / design.json / sdk.config
src/game/        board.js（纯三消引擎）+ sim.js（run 生命周期）+ rng.js
src/render/      深空背景 + 8×8 星阵 + 特殊星 + 粒子（theme.js 三场景包）
src/ui/          标题/暂停/结算/设置/HUD/首次引导
src/core/        i18n / save / sdk / audio（WebAudio 程序化）
tools/           selfplay / verify.plan / audio-check / capture / poster / record-gif
tests/           纯逻辑测试
tests/final/     验收截图 + 各门禁报告
```
