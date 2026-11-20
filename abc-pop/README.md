# ABC POP

> Pop the letter bubbles in a candy sky! 糖果天空里点破字母泡泡。

一款无挫败的幼儿字母认知游戏：26 个字母 × 3 轮（认读 / 大小写 / 首字母词），点对得分、连续 5 对触发彩虹字母桥，点错只抖动不扣分。

## 运行

```bash
cd games/abc-pop
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态、零运行期依赖（站点 SDK 有本地降级 mock）。

## 操作

| 动作 | 方式 |
| --- | --- |
| 点泡泡 | 鼠标 / 触屏点击 |
| 暂停 | Esc / P |
| 语言 | 右上角下拉，或设置 |

## 目录

```
index.html / styles.css     入口与样式
config/                     数值 / 字母数据 / 文案 / design.json / sdk.config
src/core/                   i18n / sdk / audio（程序化 WebAudio）
src/game/                   sim（纯逻辑）/ rng
src/render/                 三场景包 Canvas 渲染
src/ui/                     HUD / 屏幕 / 首次引导
src/main.js                 装配 / 固定步长 / 状态机 / __ll 调试口
tools/                      selfplay / audio-check / verify.plan / record-gif / make-poster
tests/                      纯逻辑测试（node --test）
```

## 验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

详见 `docs/report.md`。
