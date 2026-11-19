# LINK LINE PAIR · 霓虹连线

> 一款霓虹街机风的星座连线游戏：沿淡色参考线，把星点依次连成星座，连错或踩中岩石就丢命，连击越快星评越高。

## 运行

```bash
cd link-line-pair
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 操作 |
| --- | --- |
| 点选星点 / 连线 | 鼠标点按或拖拽（触屏同） |
| 提示（手指走一遍剩余路径） | HUD ✦ 按钮 |
| 撤销（撤回最后一笔） | HUD ↩ 按钮 |
| 暂停 / 恢复 | Esc / P |
| 重开本关 | R 或 HUD ↻ |
| 静音 | M 或 HUD 🔊 |

## 玩法

- 淡色参考线就是目标星座；每连好相邻两星 = 点亮 1 段，连完全部段获胜。
- 连错星点或踩中岩石扣 1 命，3 次失误失败；超时也失败。
- 2.5 秒内连续连线叠连击倍率；无失误且不超时 = 3 星。
- 12 关，逐关解锁；星星累计显示在标题关卡格。

## 语言

- 默认 **英文**；`?lang=zh` 可切 **中文**；选择写入 localStorage，刷新保留。

## 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html         入口（竖屏提示 + 教程 DOM 标记）
styles.css         霓虹街机样式
config/            数值 / 关卡 / 文案 / 设计源 / SDK 配置
src/core/          i18n / SDK / 程序化音频
src/game/          纯逻辑 sim（无 DOM，可测）
src/render/        Canvas 2D 渲染
src/ui/            UI 模块
src/main.js        装配 + 调试契约
src/vendor/        vendored pipysdk（无外链、广告关闭）
tests/             单元测试
tools/             selfplay / verify plan / audio-check
```

## 调试契约

`window.__ll`：`state.phase/lang`、`start(i)/pause/resume/restart/home`、`run`、
`tutorial.{active,step,steps}`、`startTutorial`、`debug.{state,solve,loadLevel,setTutorialDone}`。
