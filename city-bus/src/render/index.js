// Canvas 2D 渲染：俯视角城市 + 道路 + 建筑 + 站点 + 巴士 + HUD。
import { WORLD, ROAD_W, V_ROADS, H_ROADS, BUS, STOPS, STOP_RADIUS, RULES, COLORS } from '../../config/game.config.js';
import { BUILDINGS } from '../game/sim.js';
import { t } from '../core/i18n.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const HW = ROAD_W / 2;
const PARKS = new Set([5, 10]);

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let pulse = 0;
  const floaters = [];

  function clearEffects() { floaters.length = 0; }
  function addFloater(text, x, y, color) { floaters.push({ text, x, y, life: 1.2, color }); }
  function update(dt) {
    pulse += dt;
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt; f.y -= 26 * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
  }

  function drawGround() {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawRoads() {
    ctx.fillStyle = COLORS.road;
    for (const vx of V_ROADS) ctx.fillRect(vx - HW, 0, ROAD_W, WORLD.HEIGHT);
    for (const hy of H_ROADS) ctx.fillRect(0, hy - HW, WORLD.WIDTH, ROAD_W);
    // 路缘
    ctx.fillStyle = COLORS.roadEdge;
    for (const vx of V_ROADS) { ctx.fillRect(vx - HW, 0, 3, WORLD.HEIGHT); ctx.fillRect(vx + HW - 3, 0, 3, WORLD.HEIGHT); }
    for (const hy of H_ROADS) { ctx.fillRect(0, hy - HW, WORLD.WIDTH, 3); ctx.fillRect(0, hy + HW - 3, WORLD.WIDTH, 3); }
    // 车道虚线
    ctx.strokeStyle = 'rgba(217,222,230,0.55)';
    ctx.lineWidth = 3; ctx.setLineDash([20, 18]);
    for (const vx of V_ROADS) { ctx.beginPath(); ctx.moveTo(vx, 0); ctx.lineTo(vx, WORLD.HEIGHT); ctx.stroke(); }
    for (const hy of H_ROADS) { ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(WORLD.WIDTH, hy); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  function drawBuildings() {
    BUILDINGS.forEach((b, i) => {
      if (PARKS.has(i)) {
        ctx.fillStyle = COLORS.park;
        roundRect(ctx, b.x + 4, b.y + 4, b.w - 8, b.h - 8, 10); ctx.fill();
        ctx.fillStyle = '#3c6b38';
        for (let k = 0; k < 4; k++) {
          const tx = b.x + 24 + ((k * 53) % (b.w - 48));
          const ty = b.y + 24 + ((k * 71) % (b.h - 48));
          ctx.beginPath(); ctx.arc(tx, ty, 13, 0, Math.PI * 2); ctx.fill();
        }
        return;
      }
      const ci = i % COLORS.building.length;
      ctx.fillStyle = COLORS.building[ci];
      roundRect(ctx, b.x + 3, b.y + 3, b.w - 6, b.h - 6, 6); ctx.fill();
      ctx.fillStyle = COLORS.roof[ci];
      roundRect(ctx, b.x + 12, b.y + 12, b.w - 24, b.h - 24, 5); ctx.fill();
      // 窗户
      ctx.fillStyle = 'rgba(255,235,180,0.35)';
      for (let wy = b.y + 22; wy < b.y + b.h - 22; wy += 26)
        for (let wx = b.x + 22; wx < b.x + b.w - 22; wx += 26)
          if ((wx * 3 + wy * 7) % 4 < 2) ctx.fillRect(wx, wy, 9, 9);
    });
  }

  function drawStops(run) {
    const destSet = new Set(run ? run.passengers.filter((p) => p.state === 'aboard').map((p) => p.dest) : []);
    STOPS.forEach((s, i) => {
      const isDest = destSet.has(i);
      const waiting = run ? run.passengers.filter((p) => p.state === 'waiting' && p.origin === i).length : 0;
      // 区域
      ctx.fillStyle = isDest ? 'rgba(56,189,248,0.18)' : COLORS.stopZone;
      ctx.beginPath(); ctx.arc(s.x, s.y, STOP_RADIUS, 0, Math.PI * 2); ctx.fill();
      if (isDest) {
        const r = STOP_RADIUS + Math.sin(pulse * 4) * 5;
        ctx.strokeStyle = COLORS.dest; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
      }
      // 站牌
      ctx.fillStyle = '#5b6472';
      ctx.fillRect(s.x - 2, s.y - 30, 4, 30);
      ctx.fillStyle = isDest ? COLORS.dest : COLORS.stop;
      roundRect(ctx, s.x - 13, s.y - 44, 26, 18, 4); ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BUS', s.x, s.y - 35);
      // 候车乘客
      if (waiting > 0) {
        for (let k = 0; k < Math.min(waiting, 4); k++) {
          ctx.fillStyle = COLORS.passenger;
          ctx.beginPath(); ctx.arc(s.x - 18 + k * 12, s.y + 18, 5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath(); ctx.arc(s.x - 18 + k * 12, s.y + 12, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.font = `bold 13px ${FONT}`;
        ctx.fillText(String(waiting), s.x + 26, s.y + 18);
      }
    });
  }

  function drawBus(run) {
    const b = run.bus;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.heading);
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -BUS.L / 2 + 3, -BUS.W / 2 + 4, BUS.L, BUS.W, 8); ctx.fill();
    // 轮子
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-BUS.L / 2 + 6, -BUS.W / 2 - 3, 14, 6);
    ctx.fillRect(-BUS.L / 2 + 6, BUS.W / 2 - 3, 14, 6);
    ctx.fillRect(BUS.L / 2 - 20, -BUS.W / 2 - 3, 14, 6);
    ctx.fillRect(BUS.L / 2 - 20, BUS.W / 2 - 3, 14, 6);
    // 车身
    ctx.fillStyle = COLORS.bus;
    roundRect(ctx, -BUS.L / 2, -BUS.W / 2, BUS.L, BUS.W, 8); ctx.fill();
    ctx.strokeStyle = COLORS.busDark; ctx.lineWidth = 2; ctx.stroke();
    // 车窗
    ctx.fillStyle = COLORS.busWindow;
    for (let k = 0; k < 3; k++) roundRect(ctx, -BUS.L / 2 + 10 + k * 15, -BUS.W / 2 + 5, 11, BUS.W - 10, 3), ctx.fill();
    // 前挡风
    ctx.fillStyle = COLORS.busWindow;
    roundRect(ctx, BUS.L / 2 - 12, -BUS.W / 2 + 4, 8, BUS.W - 8, 3); ctx.fill();
    // 车头灯
    ctx.fillStyle = '#fff7cc';
    ctx.beginPath(); ctx.arc(BUS.L / 2 - 2, -BUS.W / 2 + 6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(BUS.L / 2 - 2, BUS.W / 2 - 6, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 目的地方向箭头（第一个在车上的乘客）
    const aboard = run.passengers.find((p) => p.state === 'aboard');
    if (aboard) {
      const d = STOPS[aboard.dest];
      const ang = Math.atan2(d.y - b.y, d.x - b.x);
      ctx.save();
      ctx.translate(b.x, b.y - 46);
      ctx.rotate(ang);
      ctx.fillStyle = COLORS.dest;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-3, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawHud(run) {
    ctx.textBaseline = 'middle';
    // 左上：现金 / 送达
    ctx.fillStyle = 'rgba(8,12,26,0.72)';
    roundRect(ctx, 16, 16, 190, 62, 12); ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(t('money'), 30, 34);
    ctx.font = `900 24px ${FONT}`; ctx.fillStyle = '#4ade80';
    ctx.fillText('$' + run.money, 30, 56);
    ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(`${t('delivered')}: ${run.delivered}`, 110, 56);
    // 中上：倒计时
    const sec = Math.ceil(run.timeLeft);
    const mm = Math.floor(sec / 60), ss = sec % 60;
    ctx.fillStyle = 'rgba(8,12,26,0.72)';
    roundRect(ctx, WORLD.WIDTH / 2 - 70, 16, 140, 62, 12); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(t('time'), WORLD.WIDTH / 2, 34);
    ctx.font = `900 26px ${FONT}`;
    ctx.fillStyle = sec <= 10 ? '#f87171' : '#fff';
    ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, WORLD.WIDTH / 2, 56);
    // 车上人数
    const aboard = run.passengers.filter((p) => p.state === 'aboard').length;
    ctx.fillStyle = 'rgba(8,12,26,0.72)';
    roundRect(ctx, 220, 16, 150, 62, 12); ctx.fill();
    ctx.textAlign = 'left';
    ctx.font = `bold 12px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(t('aboard'), 234, 34);
    ctx.font = `900 22px ${FONT}`; ctx.fillStyle = COLORS.bus;
    ctx.fillText(`${aboard}/${RULES.capacity}`, 234, 56);
  }

  function drawFloaters() {
    for (const f of floaters) {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  function render({ run }) {
    drawGround();
    drawRoads();
    drawBuildings();
    if (run) {
      drawStops(run);
      drawBus(run);
      drawHud(run);
      drawFloaters();
    }
  }

  return { render, update, clearEffects, addFloater };
}