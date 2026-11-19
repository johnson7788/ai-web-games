# FLAP REBORN

> 霓虹小鸟

## 运行

```bash
cd flap-reborn
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 |
| --- | --- |
| 左移 | A / ← |
| 右移 | D / → |
| 跳跃 | Space |
| 暂停 | Esc |

## 语言

- 默认 **英文**；标题右上角 / 暂停屏的下拉可切 **中文 / 日本語 / 한국어 / العربية / Русский**。
- 阿拉伯语自动切 **RTL**（`<html dir="rtl">`）。
- `?lang=zh` / `?lang=ja` / `?lang=ar` 等可临时覆盖；选择写入 localStorage（`<slug>-lang`），刷新后保留。
- 所有可见文案走 `config/locales.js` 的 `t()`；**en 与 zh 必须完整**，ja/ko/ar/ru 有条件补齐，**没翻完就整块删掉**（缺的语言不会出现在下拉里）。
- 新语言自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`。

## 测试

```bash
node --test
```

## 截图 / 验收

```bash
# 截图
node ../../skills/webgame-playbook/scripts/shot.mjs --root . --out tests/artifacts/shot.png

# 完整验收
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/artifacts
```

## 趣味验证（G0.5 / G4.5，全自动）

```bash
# 1) 设计结构：填 config/design.json，FAIL 就先改设计（不写代码）
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .

# 2) 自动玩测：让 tools/selfplay.mjs 每跑完一局写 tools/fun/autoplay.json
#    至少 3 条策略：greedy / random / noinput
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .

# 3) 截图评审：verify-game 产出 tests/final/*.png 后跑
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
```

判定标准见 references/fun-design.md §10（Auto Fun Gate）：首次输入 ≤10s、输入延迟 ≤120ms、首胜 ≤60–120s、
操作 ≥60/min、空转 ≤15%、事件间隔 ≤3s、推进率 ≥60%。**没有真人试玩环节。**

## 素材（强烈建议 AI 生成图片/文字/音频）

```bash
node ../../skills/webgame-playbook/scripts/artgen.mjs doctor      # 先看显卡，别抢别人的卡
cp tools/artgen/plan.example.json tools/artgen/plan.json          # 改提示词/尺寸
node ../../skills/webgame-playbook/scripts/artgen.mjs run --plan tools/artgen/plan.json --dry-run
node ../../skills/webgame-playbook/scripts/artgen.mjs run --plan tools/artgen/plan.json
# 按规则自动挑图：tools/artgen/pick.json  {"hero": 12}
python3 ../../skills/webgame-playbook/scripts/assetprep.py --root . --plan tools/artgen/plan.json
node ../../skills/webgame-playbook/scripts/asset-check.mjs --root .
```

规则见 SKILL.md G2.5 与 references/asset-pipeline.md：强烈建议 AI 生成图片/文字/音频；来源登记与体积预算硬线已取消，asset-check 只查文件齐/alpha/引用 0 404/无外链。

## 目录

```
index.html          入口
styles.css          样式
config/             配置与文案（design.json = 机器可读设计源）
src/core/           i18n、存档
src/game/           纯逻辑
src/render/         渲染
src/ui/             UI
src/main.js         主入口
assets/             美术素材（AI 出图 → assetprep 产出；_src 不进 git）
assets/manifest.json 素材清单（尺寸/pivot；来源/体积可选）
tests/              测试
tools/              工具与验收计划
tools/artgen/       素材生成计划（plan.json / pick.json）
tools/fun/          设计审计/玩测遥测/视觉评审（G0.5/G4.5）
```

## 调试契约

`window.__ll` 暴露标准调试接口：
- `state.phase`: title / playing / paused
- `start()` / `pause()` / `resume()` / `restart()`
- `startAct()`: start() 的别名
- `run`: 当前 sim 实例
