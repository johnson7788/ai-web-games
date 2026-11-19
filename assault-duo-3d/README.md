# ASSAULT DUO 3D

> 突击双雄 3D · 霓虹屋顶双人突击

## 运行

```bash
cd assault-duo-3d
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 |
| --- | --- |
| 左/右移动 | A/D 或 ←/→ |
| 二段跳 | W / ↑ / Space |
| 开火（自动瞄准） | 按住 J |
| 切换武器 | E |
| 合体爆破 | F（能量满时） |
| 暂停 | Esc |

移动端：左侧摇杆移动，右侧 FIRE / JUMP / SWITCH / BLAST 按钮。

## 玩法

玩家 NOVA 与 AI 搭档 JET 在霓虹城顶抵御成波来袭的无人机。清空全部敌人过关；血量归零失败。
击杀敌人累积连击（加成伤害）与 DUO 能量；能量满按 F 释放全屏合体爆破。每关结算 1–3 星。

## 语言

默认英文；`?lang=zh` 可切换中文，标题右上角下拉可切。

## 测试

```bash
node --test
node tools/selfplay.mjs
node tools/audio-check.mjs
```

## 验收

```bash
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
```

## 目录

```
index.html / styles.css   入口与样式
config/                   数值、文案、设计源、SDK 配置
src/core/                 i18n、存档、SDK、音频（纯 WebAudio）
src/game/sim.js           纯逻辑（可 headless 测试 / selfplay）
src/render/               Canvas 程序化渲染（霓虹街机风）
src/ui/                   DOM UI
src/main.js               60Hz 固定步长装配
tools/                    门禁计划 / selfplay / audio-check
```
