# LIFE RESTART SIM · 人生重开模拟器

> 霓虹转生街机：投币 → 选 3 个天赋 → 分配初始点数 → 一年一年熬过随机人生与命运抉择 → 用总评星级换下一世。

零构建纯静态：`index.html` + ES Module；`python3 -m http.server` 可跑；零依赖零外链，美术全 canvas 程序化，音频纯 WebAudio。

## 运行

```bash
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 交互 |
| --- | --- |
| 选天赋 | 点击卡片（选 3 个） |
| 分配点数 | +/- 按钮 / 随机分配 |
| 推进人生 | 下一年 / 自动播放（×1/×2/×4/×8） |
| 命运抉择 | A / B 二选一 |
| 暂停 | Esc / P |

## 语言

默认英文；标题右上角可切中文。`?lang=zh` 可临时覆盖。en / zh 完整。

## 测试与验收

```bash
node --test                        # 单元测试
node tools/selfplay.mjs            # greedy/random/noinput → tools/fun/autoplay.json
node tools/audio-check.mjs         # 离屏渲染 BGM/SFX 复验
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 调试契约

`window.__ll`：`state.phase` / `start` / `pause` / `resume` / `restart` / `run` / `tutorial` / `startTutorial`。
`window.__ll.debug`：`pickBestTalents` / `autoAllocate` / `startLife` / `advanceTo` / `resolveChoice` / `fastLife`。
