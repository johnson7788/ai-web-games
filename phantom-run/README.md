# PHANTOM RUN

> 幽影疾跑 — 半透明的幽影从魔塔出逃：自动跑酷 + 单键跳跃，踩符文砖虚化坠落，捡月光斑现身穿墙。

## 运行

```bash
cd games/phantom-run
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 跳跃 | 空格 / W / ↑ / 点击屏幕 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- 自动前进，只按一个键跳跃，跨过瓦檐间隙、躲开尖刺。
- **符文砖**：踩上去立刻虚化（你会穿它坠落），`RUNE_REVERT_SEC` 后恢复实体；双符文互锁一虚一实，须踩序。
- **月光斑**：拾取后短暂「现身」，可穿过发光的符文墙（默认虚影撞墙判负）。
- **塌陷檐**：踩后 0.8s 坠落；**移动吊篮**：竖直升降；**鬼火追兵**：身后步步紧逼。
- 三场景 12 关：暮色魔塔 / 月夜街市 / 破晓城墙；每关三星（抵达出口 + 收齐星屑 + 碰触月光）。

## 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 调试契约

`window.__ll` 暴露：`state.phase`、`start/pause/resume/restart/home`、`run/sim`、`tutorial`、`fps`、`debug.{state,layout,loadLevel,startSeeded,setTutorialDone,fastForward,autoRun,hold,setAutoPlay}`。
