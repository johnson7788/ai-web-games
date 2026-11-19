# STARWAR DEFENSE · 星际防线

> 霓虹街机风星际防线：按住主炮击落俯冲的外星战机，攒满能量放清屏大招，守住星港。

零构建纯静态（`index.html` + ES Module），零运行期依赖（无 CDN/外链/素材文件）；美术全部程序化 Canvas/SVG/DOM，音频纯 WebAudio。

## 运行

```bash
cd starwar-defense
python3 -m http.server 8124
# 打开 http://127.0.0.1:8124/
```

## 操作

| 动作 | 键 / 触屏 |
| --- | --- |
| 主炮连发 | 按住鼠标 / 触屏 / 空格 |
| 大招（能量满） | Enter / B / 右下角 SUPER 按钮 |
| 暂停 / 继续 | Esc / P |
| 重开本波 | R |
| 静音 | M |

副炮在第 2、3 波自动解锁；敌人掉落的道具（速射 R / 冰冻 F / 护盾 S）落到基座自动拾取；每 5 波一个 Boss。

## 语言

- 默认 **英文**；标题 / 暂停屏下拉可切 **中文**；`?lang=zh` 可临时覆盖，选择写入 localStorage。
- 所有文案走 `config/locales.js` 的 `t()`；en 与 zh 完整。

## 门禁（全部绿）

```bash
node --test
node tools/selfplay.mjs
node ../../skills/webgame-playbook/scripts/verify-game.mjs --root . --plan tools/verify.plan.json
node ../../skills/webgame-playbook/scripts/i18n-check.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-audit.mjs --root .
node ../../skills/webgame-playbook/scripts/fun-report.mjs --root .
node tools/scene-shots.mjs                                            # 生成 tests/final/ 战斗截图 + poster.jpg
node ../../skills/webgame-playbook/scripts/vision-review.mjs --root .
node ../../skills/webgame-playbook/scripts/tutorial-check.mjs --root . --out tests/artifacts
node ../../skills/webgame-playbook/scripts/sdk-check.mjs --root .
node tools/audio-check.mjs
```

## 目录

```
index.html           入口
styles.css           样式
config/              配置与文案（design.json = 机器可读设计源）
src/core/            i18n / sdk / audio
src/game/            纯逻辑模拟器（sim / level，可无头测试）
src/render/          Canvas 程序化渲染
src/ui/              DOM UI
src/vendor/          vendored pipysdk
tests/               node --test
tools/               自对弈 / 截图 / 音频验收 / 验收计划
```

## 调试契约

`window.__ll`：`{ state:{phase,lang}, start, pause, resume, restart, run, tutorial:{active,step,steps,current}, startTutorial, save, ui, debug }`。
