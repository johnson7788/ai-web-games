# monkey-marble 定点修复（第 2 轮）

## 结论

G5 全套门禁仅 `vision` FAIL，其余（tests / fun-audit / i18n / asset / tutorial / sdk / verify / fun-report）均 PASS。本轮修复 vision 并重跑，**vision 已 PASS**。

## 根因（来自 gate-monkey-marble.r2.log + 代码定位）

vision-review 判定 FAIL 的唯一触发点是 **silhouette 均分 5.8 < 6**（`readable 8.4 / silhouette 5.8 / style 8.4`）。逐张看拉低均分的是：

1. `tutorial-replay.png` silhouette 仅 **3**：从标题重看教程时，模态底 `rgba(11,18,32,0.99)` 仍有 1% 透光，标题屏的「MONKEY MARBLE」大标题透出来变成幽灵字，模型判「背景文字模糊且部分被遮挡」。
2. `tutorial-first.png` / `tutorial-replay.png` 都报「粉色方块按钮无文本标签」：`#tut-skip`（Skip 按钮）在 `index.html` 里既无 `data-i18n`，`applyLang()` 也没给它赋文案，实际渲染成一个**空粉色按钮**。
3. `tutorial-after-skip.png` / `tutorial-first.png` 报「小球与轨道边界对比度低 / 玩家角色未突出」：玩家球是 `opacity:0.5` 的半透明白球，压在粉色轨道 + 浅蓝天空上，剪影弱。

## 修复（改游戏，不改测量）

- `index.html`：给 `#tut-skip` 加 `data-i18n="skip"`（复用现有 i18n 机制，key 已存在）。
- `styles.css`：`#tutorial.modal` 背景由 `rgba(11,18,32,0.99)` 改为不透明 `#0b1220`，彻底消除标题透字。
- `src/render/index.js`：玩家球 `opacity` 0.5 → 0.92，并加一个 `BackSide` 深色反向壳（`0x1e293b`，半径 ×1.14）做描边，提升剪影对比。

## 重跑结果

```bash
/opt/homebrew/bin/node --test                                  # 19/19 pass
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .   # ✓ tutorial PASS
/opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .    # 结论：PASS
```

vision-review 实际输出：

```
5 张 · 模型 dashscope/qwen3-vl-plus · 均分 readable 8.4 / silhouette 6.6 / style 8.4
结论：PASS

| tests/final/desktop.png           | 9 | 7 | 8 | Y | N | N | Y |
| tests/final/mobile.png            | 9 | 7 | 8 | Y | N | N | Y |
| tests/final/tutorial-after-skip.png | 7 | 8 | 9 | Y | N | N | Y |
| tests/final/tutorial-first.png    | 8 | 6 | 9 | Y | N | N | Y |
| tests/final/tutorial-replay.png   | 9 | 5 | 8 | Y | N | N | Y |
```

silhouette 5.8 → 6.6（> 6），`hud_overlap` / `text_clipped` / `goal_visible` / `mobile_safe` 全部干净，无 critical、无 lowMeans → PASS（退出码 0）。

## 未动项（说明）

- 其余门禁本就 PASS，未改动测量脚本与其它目录。
- vision 剩余 issue 均为非阻断的建议（如 `BEST 0:00` 字号、语言下拉间距、教程步骤指示器），不影响判定；本轮未改。
