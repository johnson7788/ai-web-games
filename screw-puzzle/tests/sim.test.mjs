import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, createLevelFromDef } from '../src/game/level.js';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { WORLD, GAME, CONFIG } from '../config/game.config.js';

// 构造一个能确定遮挡关系的两板关卡：
// P0 顶部螺丝被上层 P1 覆盖，底部螺丝暴露。
const coverDef = {
  id: 1,
  name: { en: 't', zh: 't' },
  plates: [
    { x: 400, y: 400, w: 200, h: 100, angle: 0, color: '#888', screws: [{ x: 0, y: -20 }, { x: 0, y: 20 }] },
    { x: 400, y: 335, w: 200, h: 100, angle: 0, color: '#555', screws: [{ x: 0, y: 0 }] },
  ],
};

test('遮挡：上层板覆盖的螺丝不可拧（covered），暴露的可拧', () => {
  const level = createLevelFromDef(coverDef);
  const blocked = level.unscrew('0-0');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'covered');
  const free = level.unscrew('0-1');
  assert.equal(free.ok, true);
});

test('计数：可拧螺丝拧掉后螺丝数减一', () => {
  const level = createLevel(0);
  const before = level.getState().screwsLeft;
  const st = level.getState();
  let id = null;
  for (let i = st.plates.length - 1; i >= 0 && !id; i -= 1) {
    for (const s of st.plates[i].screws) if (!s.covered) { id = s.id; break; }
  }
  assert.ok(id, '应存在一颗可拧螺丝');
  assert.equal(level.unscrew(id).ok, true);
  assert.equal(level.getState().screwsLeft, before - 1);
});

test('掉板：一块板螺丝清零后开始下落（y 随 step 增大）', () => {
  const level = createLevel(0);
  const top = level.plates[level.plates.length - 1];
  for (const s of top.screws) level.unscrew(s.id, true);
  assert.equal(top.released, true);
  const y0 = top.y;
  level.step(1 / 60);
  assert.ok(top.y > y0, '释放的板应受重力下落');
});

test('过关：所有板掉出屏幕后判定 cleared', () => {
  const level = createLevel(0);
  for (const p of level.plates) for (const s of p.screws) level.unscrew(s.id, true);
  assert.equal(level.cleared, false, '螺丝清空但板尚未掉落时不算过关');
  for (let i = 0; i < 300 && !level.cleared; i += 1) level.step(1 / 60);
  assert.equal(level.cleared, true);
  assert.equal(level.getState().cleared, true);
});

test('星级：用时阈值评定 1–3 星', () => {
  const level = createLevel(0);
  const th = level.starThresholds();
  assert.ok(th.three < th.two, '三星阈值应严于二星');
  level.time = th.three;
  assert.equal(level.starRating(), 3);
  level.time = th.two;
  assert.equal(level.starRating(), 2);
  level.time = th.two + 1;
  assert.equal(level.starRating(), 1);
});

test('关卡数据：30 关、每关 2–5 板、每板 2–4 螺丝、坐标合法', () => {
  assert.equal(LEVEL_COUNT, 30);
  for (const lv of LEVELS) {
    assert.ok(lv.plates.length >= 2 && lv.plates.length <= 5, `关卡 ${lv.id} 板数应在 2–5`);
    for (const p of lv.plates) {
      assert.ok(p.screws.length >= 2 && p.screws.length <= 4, `关卡 ${lv.id} 螺丝数应在 2–4`);
      assert.ok(Math.abs(p.angle) <= 8, '初始倾角应在 ±8°');
      assert.ok(p.w > 0 && p.h > 0, '板尺寸应为正');
      assert.ok(p.x - p.w / 2 >= 0 && p.x + p.w / 2 <= WORLD.WIDTH, '板应落在世界横界内');
      assert.ok(p.y - p.h / 2 >= 0 && p.y + p.h / 2 <= WORLD.HEIGHT, '板应落在世界纵界内');
      for (const s of p.screws) {
        assert.ok(Math.abs(s.x) <= p.w / 2 && Math.abs(s.y) <= p.h / 2, '螺丝应相对板内');
      }
    }
  }
});

test('角度归一化：超出 ±8° 的倾角被夹紧', () => {
  const def = { id: 1, name: {}, plates: [{ x: 400, y: 400, w: 200, h: 100, angle: 15, color: '#888', screws: [{ x: 0, y: 0 }] }] };
  const defNeg = { id: 1, name: {}, plates: [{ x: 400, y: 400, w: 200, h: 100, angle: -20, color: '#888', screws: [{ x: 0, y: 0 }] }] };
  assert.equal(createLevelFromDef(def).plates[0].angle, 8);
  assert.equal(createLevelFromDef(defNeg).plates[0].angle, -8);
});

test('复位：两次 createLevel 相互独立，改一个不影响另一个', () => {
  const a = createLevel(0);
  const b = createLevel(0);
  const id = '1-0';
  a.unscrew(id, true);
  assert.equal(a.plates[1].screws.find((s) => s.id === id).removed, true);
  assert.equal(b.plates[1].screws.find((s) => s.id === id).removed, false);
});

test('总星数：过关评星累计不丢失', () => {
  const run = createRun();
  run.loadLevel(0);
  run.level.time = 0;
  assert.equal(run.completeLevel(), 3);
  assert.equal(run.totalStars, 3);
  run.loadLevel(1);
  run.level.time = 1e9;
  assert.equal(run.completeLevel(), 1);
  assert.equal(run.totalStars, 4);
});

test('失败路径：缺失/已拆的螺丝返回原因', () => {
  const level = createLevel(0);
  assert.deepEqual(level.unscrew('nope'), { ok: false, reason: 'missing' });
  const st = level.getState();
  const id = st.plates[st.plates.length - 1].screws[0].id;
  assert.equal(level.unscrew(id).ok, true);
  assert.deepEqual(level.unscrew(id), { ok: false, reason: 'removed' });
});

test('边界：越界关卡索引回绕到合法范围', () => {
  const last = createLevel(-1);
  const first = createLevel(LEVEL_COUNT);
  assert.equal(last.index, LEVEL_COUNT);
  assert.equal(first.index, 1);
});

test('配置默认值：默认英文、仅 en/zh、无 RTL', () => {
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.deepEqual(CONFIG.rtlLangs, []);
  assert.ok(GAME.GRAVITY > 0);
  assert.ok(GAME.STARS.base.three < GAME.STARS.base.two);
});

test('连续通关：真实顺序拆完前 3 关不崩', () => {
  for (let li = 0; li < 3; li += 1) {
    const level = createLevel(li);
    for (let guard = 0; guard < 2000 && !level.cleared; guard += 1) {
      const st = level.getState();
      let id = null;
      for (const p of st.plates) {
        for (const s of p.screws) if (!s.removed && !s.covered) { id = s.id; break; }
        if (id) break;
      }
      if (id) {
        const r = level.unscrew(id);
        assert.equal(r.ok, true, `关卡 ${li + 1} 应始终有可拧螺丝`);
      }
      level.step(1 / 60);
      level.drainEvents();
    }
    assert.equal(level.cleared, true, `关卡 ${li + 1} 应能通关`);
  }
});
