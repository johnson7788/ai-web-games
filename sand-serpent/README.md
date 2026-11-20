# SAND SERPENT · 沙漠沙蟒

> 网格蛇定时步进：吃甲虫/蝎子/骆驼刺变长，躲墙/仙人掌/硬地/自身，长到目标长度过关。12 关 3 场景。

## 运行

```bash
cd games/sand-serpent
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 转向 | 方向键 / WASD / 触屏滑动 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 语言

默认英文，右上角/暂停屏可切中文；`?lang=zh` 可临时覆盖，选择写入 localStorage 刷新保留。

## 测试与验收

```bash
node --test                                                        # 29 条纯逻辑测试
node tools/selfplay.mjs                                            # greedy/random/noinput 遥测
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

`window.__ll`：`state.phase / start / pause / resume / restart / home / sim / tutorial / debug.state() / debug.layout() / debug.loadLevel(i) / debug.startSeeded(i,seed) / debug.autoPlay() / debug.fastForward() / debug.greedyDir()`。
