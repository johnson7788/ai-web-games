# CANNON ECHO

> 回声炮台 · 山谷要塞：底部炮台瞄准射击，炮弹从崖壁反弹横扫，击碎逼近要塞的货箱；连射过热锁管，管理射击节奏。

## 运行

```bash
cd cannon-echo
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（唯一例外站点 SDK，可降级）。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 瞄准 | 移动鼠标 / 拖动手指 |
| 开火 | 按住鼠标 / 按住触屏（或按住 Space） |
| 回声破防 | 瞄准与目标同高的崖壁，弹回后水平横扫 |
| 暂停 | Esc / P |
| 重开 | 死亡/通关后按 R |

## 门禁

```bash
node --test                                                      # 纯逻辑测试
node tools/selfplay.mjs                                          # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

详见 [docs/report.md](docs/report.md) 与 [docs/analysis.md](docs/analysis.md)。

## 目录

```
config/          数值 / 文案 / 关卡 / 升级 / SDK 配置（config-first）
src/game/        纯逻辑（sim / rng，零 DOM）
src/render/      Canvas 程序化三场景包渲染
src/ui/          标题 / HUD / 暂停 / 结算 / 升级三选一 / 首次引导
src/core/        sdk / i18n / audio（WebAudio 程序化）
src/main.js      60Hz 固定步长装配 + window.__ll 调试契约
tests/           纯逻辑测试 + tests/final 验收截图
tools/           selfplay / verify / audio-check / shots / record-gif / poster
```
