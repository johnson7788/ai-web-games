# DEPTH DIVER · 深潜者

> 驾驶深海科考潜航器下潜马里亚纳风格海沟：按住上浮、松开下沉，躲开礁石水雷，采集发光深海生物，在氧气耗尽前抵达目标深度。

## 运行

```bash
cd depth-diver
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 上浮（按住） | Space / W / ↑ / 触摸按住 |
| 下沉（松开） | 松开 |
| 主动俯冲加速 | S / ↓ |
| 水平微调 | ← → / A D / 触摸拖动 |
| 暂停 / 继续 | Esc / P |
| 重开 | R |
| 静音 | M |

## 玩法

- **深度即分数**：自动下潜，越深压力越大、灯照半径越小。
- **样本采集**：采满 3 颗发光深海生物本关升星（后期更多）。
- **氧气 = 关计时**：氧气耗尽或撞上礁石/水雷即损毁；氧气罐可补充。
- **签名瞬间**：下潜到新的深度层时，头灯扫开黑暗 + 生物群被惊散。
- **三场景**：阳光浅海 / 微光中层 / 午夜深渊（黑底 + 生物荧光）。
- **12 关推进**：每关一条新规则（水雷阵 → 洋流 → 热泉上喷 → 追逐者 → 窄缝洞窟 → 灯照缩小 → 压力限时 → 生物群 → 双洋流 → 寒流 → 终局深渊）。
- **10 个跨局模块**：由总星数解锁（声呐 / 头灯 / 磁吸 / 护盾 / 稳定器 / 俯冲 / 慢放 / 氧气罐 / 电池 / 装甲）。

## 语言

默认**英文**，右上角 / 暂停屏可切**中文**。`?lang=zh` 可临时覆盖，刷新保留。

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

## 目录

```
index.html / styles.css   入口与样式
config/                   数值 / 关卡 / 文案 / design.json / sdk.config.js
src/core/                 i18n / sdk / audio（程序化）
src/game/                 sim（纯逻辑）/ level
src/render/               三场景 Canvas 渲染
src/ui/                   语言与屏幕显隐
src/main.js               装配 + 固定步长 + window.__ll
tests/                    纯逻辑测试
tools/                    验收脚本 / 物料脚本
```
