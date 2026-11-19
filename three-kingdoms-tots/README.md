# THREE KINGDOMS TOTS

> 三国小小将 · 卡牌出兵攻城（单人 vs AI）

## 运行

```bash
cd three-kingdoms-tots
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 手势 |
| --- | --- |
| 出兵 / 法术 / 建筑 | 点底部卡牌，再点战场（两条兵线） |
| 暂停 | Esc / P |
| 重开本关 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏的下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新后保留。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n、存档、SDK、音频（程序化 WebAudio）
src/game/sim.js     纯逻辑（能量/卡牌/战斗/连击/胜负/星级）
src/render/         canvas 程序化渲染
src/ui/             UI 薄适配层
src/vendor/         vendored pipysdk（本地降级，零外链）
tests/              测试 + 截图评审
tools/              验收计划 / selfplay / audio-check
```

## 调试契约

`window.__ll`：`state.phase/lang`、`start/pause/resume/restart/home`、`run/sim`、
`tutorial {active,step,steps,current,skip}`、`startTutorial`、`save`、
`debug {state, loadLevel, startSeeded, autoPlay, fastForward, winNow}`。
