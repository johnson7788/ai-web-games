# PIXEL MINE 3D · G5 定点修复交付（第 1 轮）

> 门禁 FAIL 项：`vision`（其余 test / fun-audit / i18n / asset / tutorial / sdk / verify / selfplay / fun-report 全绿）。
> 结论：vision 已从 **FAIL → WARN**（无 critical、无 lowMeans，退出码 0，门禁视为通过）。

## 根因

`assets/sky.jpg` 不是天空，而是 Lead 生成的 **Minecraft 风格景观全景**（含层叠山丘、树、大型木质瞭望塔）。渲染层把它当作等距柱状 360° 天空背景（`scene.background`），于是画面里凭空多出「黑色箭头状山脊线」和「右侧木架/木质结构」。

视觉模型把这些背景物读成游戏内的「可交互物/障碍路径」：
- 山脊轮廓 → `silhouette` 被压低（「黑色箭头轨迹线密集且方向混乱」）；
- 右下角触屏按钮压在背景「结构体」上 → `hud_overlap` 判 FAIL。

## 改动（只动 pixel-mine-3d，未改测量脚本）

1. `src/render/index.js` — 去掉 `sky.jpg` 加载，改用程序化天空渐变（深蓝→浅蓝→近白），并留 `ponytail:` 注释说明接图 agent 换成真天空后再恢复。
2. `index.html` + `styles.css` — 标题屏内容包进 `.title-panel` 深色卡片；标题改用描边（去发光模糊）；`Best depth` 提亮；结果屏数值提亮。
3. `styles.css` — 触屏按钮改为 2 列紧凑网格（MINE 全宽），减少对场景的遮挡。

## 重跑真实输出

```
$ /opt/homebrew/bin/node --test
ℹ tests 23 / pass 23 / fail 0

$ /opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/asset-check.mjs --root .
✓ 素材总量 1611KB · 6 项素材 · 代码里 4/4 处素材引用可解析
=== PASS · 3/3 ===

$ /opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
en 85 keys · zh 85 keys · missing 0 · empty 0 → ✓ i18n OK

$ /opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
"pass": true （✓ 0 console/page error，✓ 0 失败请求，✓ 降级可玩）

$ /opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
"pass": true · fps 60 · 0 console error / 0 pageerror / 0 404

$ /opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root .
✓ tutorial PASS

$ /opt/homebrew/bin/node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
均分 readable 7.8 / silhouette 7.4 / style 8.4
结论：WARN（critical 0 · lowMeans 0）
```

## vision 关键帧对比

| 项 | 修复前 | 修复后 |
| --- | --- | --- |
| silhouette 均分 | 5.6（<6 FAIL） | 7.4 |
| mobile-game hud_overlap | N→Y（临界） | N（清除） |
| 黑色箭头轨迹线/木架误判 | 每帧出现 | 消失 |

## 未做项 / 遗留

- `03-mining` 仍有「挖出的竖井口（1×1 深色方块）被判箭头状障碍」——这是挖掘玩法的真实结果，非背景 bug，分数已到 6（达标）。
- 结果屏 `Daily goal: —` 未完成时的语义仍偏弱（模型建议加说明），非 FAIL 项，未动。
- `sky.jpg` 已停用，待接图 agent 提供「纯天空」素材后恢复加载（代码里已留注释位置）。
