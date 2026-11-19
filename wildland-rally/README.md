# WILDLAND RALLY

> 霓虹废土竞技场（Neon Wasteland Arena）— 俯视角生存竞技场乱斗，程序化 canvas + WebAudio，零素材零外链。

## 运行

```bash
cd wildland-rally
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 桌面 | 触屏 |
| --- | --- | --- |
| 移动 | WASD / 方向键 | 左下摇杆 |
| 闪烁（冲刺） | Space | DASH 按钮 |
| 新星爆发 | E | NOVA 按钮 |
| 暂停 | Esc / P | — |

自动炮会持续朝最近敌人开火；连续击杀获得连击加分；拾取道具回血/护盾/加速/磁吸；清完 4 波胜利。

## 语言

默认英文；标题右上角可切中文。`?lang=zh` 可覆盖，选择写入 localStorage。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll` 暴露 `{ state:{phase,lang}, start, pause, resume, restart, run, tutorial:{active,step,steps}, startTutorial }`。
