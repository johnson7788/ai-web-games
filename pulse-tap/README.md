# PULSE TAP（脉冲节拍）

> 心跳夜店 DJ 台：四条霓虹能量轨落下脉冲，看准节拍按 DFJK 点中判定线，连击 8 次 Perfect 进入律动模式。

## 运行

```bash
cd pulse-tap
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 四轨命中（0/1/2/3） | D / F / J / K |
| 长按 note | 按住不放，松手结算 |
| 滑键 | 相邻轨滑接 |
| 暂停 | Esc / P |
| 重开 | R |
| 静音 | M |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage（`pulse-tap-lang`），刷新保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；**en 与 zh 完整**，未完整翻译的语言整块不暴露。

## 门禁

```bash
node --test                                                        # 纯逻辑测试
node tools/selfplay.mjs                                            # 3 策略遥测
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .  # 设计结构审计
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root . # bot 遥测 Fun Gate
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

## 物料

```bash
node tools/make-shots.mjs     # tests/final 8 张验收截图
node tools/make-poster.mjs    # poster.jpg + poster-1920.jpg
node tools/make-icon.mjs      # icon.png + favicon.png
node tools/record-gif.mjs     # game.gif（480×270）
```

## 调试契约

`window.__ll` 暴露标准调试接口：`state.phase` / `start` / `pause` / `resume` / `restart` / `run`，以及 `debug.state / layout / loadLevel / startSeeded / autoPlay / fastForward / seek / freeze`。
