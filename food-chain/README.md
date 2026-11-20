# FOOD CHAIN

> 深海食物网 · 体型进化吞噬：吃掉比你小的，躲开比你大的，从浮游一路进化成 Apex Light。

## 运行

```bash
cd food-chain
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态，零运行期依赖（唯一例外：站点 SDK，断网可降级）。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 移动 | 鼠标跟随 / 触屏拖动 / WASD / 方向键 |
| 暂停 | Esc |
| 重开 | R（死亡后） |

## 语言

默认 **英文**，标题右上角下拉可切 **中文**；选择写入 localStorage（`food-chain-lang`），刷新保留；`?lang=zh` 可临时覆盖。全部文案走 `config/locales.js`。

## 测试 / 门禁

```bash
node --test                                                   # 纯逻辑测试
node tools/selfplay.mjs                                       # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 素材

美术全程序化 Canvas（发光生物 / 三场景包），BGM 与 SFX 全部 WebAudio 程序化合成（无音频文件）；封面 `poster.jpg` 与列表动图 `game.gif` 由 `tools/make-poster.mjs` / `tools/record-gif.mjs` 生成。

## 调试契约

`window.__ll`：`state.phase` / `lang` / `setLang` / `run` / `start` / `pause` / `resume` / `restart` / `tutorial` / `save` / `ui` / `debug.layout()`。
