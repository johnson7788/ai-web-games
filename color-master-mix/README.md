# COLOR MASTER MIX · 色彩大师混色

> 霓虹街机风的分格涂色拼图：用 8×8 色板把程序化图形一格一格点亮，封印格要等邻居上色才解锁，连击上色抢时间换三星。

## 运行

```bash
cd color-master-mix
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

零构建纯静态：`index.html` + ES Module，无任何运行期依赖 / CDN / 外链 / 素材文件；美术全部程序化 canvas/DOM，音频纯 WebAudio。

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 选色 | 点右侧色板任意色块（色系 × 色块） |
| 上色 | 点画布上发亮的分格 |
| 撤销 | HUD「↩」或 `U` |
| 魔法填充 | HUD「✦」（每关 1 次）或点按钮 |
| 暂停 / 继续 | `Esc` |
| 重开本关 | `R` 或 HUD「↻」 |
| 下一关 | 结算屏 `N` |
| 静音 | `M` |

## 玩法

- 每个图形由分格组成；涂满所有分格即过关。
- **封印格（rock）**：粉色虚线菱形格，要等邻居上色才解锁。
- **连击（combo）**：3 秒窗口内连续上色叠连击，撤销会断连击。
- **星级**：剩余时间 ≥33% +1 星；最大连击 ≥4 +1 星；基础 1 星。

## 语言

- 默认 **英文**；标题右上角 / 暂停屏下拉可切 **中文**。
- `?lang=zh` 可临时覆盖；选择写入 localStorage，刷新保留。
- 自检：`node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .`。

## 测试与验收

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json --out tests/final
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 调试契约

`window.__ll`：`state.phase/lang`、`start(n)`、`pause`、`resume`、`restart`、`run`、`tutorial{active,step,steps}`、`startTutorial`、`debug.fillAll()`、`debug.loadLevel(i)`、`debug.regions()`、`debug.state()`。
