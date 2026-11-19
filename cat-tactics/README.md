# CAT TACTICS

> 霓虹喵战队 · Neon cat squad — recruit, merge, patrol.

## 运行

```bash
cd cat-tactics
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 方式 |
| --- | --- |
| 招募猫咪 | 点「RECRUIT」（或按需） |
| 合并升级 | 把一只猫拖到另一只同阶猫身上 |
| 上赛道巡逻 | 把猫拖到右侧发光的赛道 |
| 停止/回收 | 拖到「DROP TO SELL」出售 |
| 战术加速 | 点「BOOST」（60 金币 ×2 收益 10s） |
| 暂停 | Esc / P |

## 语言

- 默认 **英文**；标题 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`cat-tactics-lang`）。
- 文案走 `config/locales.js`（en/zh 完整）。

## 测试 / 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll` 暴露 `state` / `start` / `pause` / `resume` / `restart` / `home` / `run` / `tutorial` / `startTutorial` / `debug.*`。
