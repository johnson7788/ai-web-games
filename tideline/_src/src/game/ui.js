// DOM HUD, screens, toasts and the minimap. Static strings live in index.html
// (translated by the kit i18n layer); dynamic strings go through I18N.t.
const $ = (id) => document.getElementById(id);
const t = (s) => (window.I18N ? window.I18N.t(s) : s);

export function fmtTime(sec) {
  if (sec == null || !isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const screens = ['title', 'pause', 'finish', 'fail'];
export function showScreen(name) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
}
export function hideScreens() {
  for (const s of screens) $(s).classList.add('hidden');
}

export const ui = {
  hud: $('hud'),
  setLoading(on, text) {
    $('loading').classList.toggle('hidden', !on);
    if (text) $('loadingText').textContent = t(text);
  },
  setHudVisible(on) { $('hud').classList.toggle('hidden', !on); },

  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.textContent = text;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2300);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  },

  flash() {
    const f = $('flash');
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  },

  countdown(label) {
    const cd = $('countdown');
    cd.classList.remove('hidden');
    const n = $('cdNum');
    n.textContent = t(label);
    n.style.animation = 'none';
    void n.offsetWidth;
    n.style.animation = '';
  },
  hideCountdown() { $('countdown').classList.add('hidden'); },

  setStats(lap, cp, time, best) {
    $('hudLap').textContent = lap;
    $('hudCp').textContent = cp;
    $('hudTimeVal').textContent = fmtTime(time);
    $('hudBest').textContent = fmtTime(best);
  },
  setSpeed(knots) { $('speedVal').textContent = Math.round(knots); },
  setBoost(frac, cooling, active) {
    const f = $('boostFill');
    f.style.width = (frac * 100).toFixed(0) + '%';
    f.classList.toggle('cooling', cooling && !active);
    $('boostState').textContent = t(active ? 'ACTIVE' : cooling ? 'CHARGING' : 'READY');
  },
  setGateTimer(frac, warn) {
    const f = $('gateTimerFill');
    f.style.width = (Math.max(0, frac) * 100).toFixed(1) + '%';
    f.classList.toggle('warn', warn);
  },
  setGateDist(meters, relBearing) {
    $('gateDistVal').textContent = Math.max(0, Math.round(meters)) + ' m';
    $('gateArrow').style.transform = `rotate(${relBearing}rad)`;
  },
  wrongWay(on) { $('wrongway').classList.toggle('hidden', !on); },
  setBestTitle(best) { $('titleBest').textContent = fmtTime(best); },

  showFinish({ time, best, isRecord, medal, splits }) {
    $('finishTime').textContent = fmtTime(time);
    $('finishBest').textContent = fmtTime(best);
    $('newRecord').classList.toggle('hidden', !isRecord);
    const m = $('medalText');
    const names = { gold: 'GOLD MEDAL', silver: 'SILVER MEDAL', bronze: 'BRONZE MEDAL', none: 'FINISHED — NO MEDAL' };
    m.textContent = t(names[medal]);
    m.className = 'medal ' + medal;
    $('lapSplits').innerHTML = '';
    splits.forEach((s, i) => {
      const d = document.createElement('span');
      d.textContent = `${t('Lap')} ${i + 1}: ${fmtTime(s)}`;
      $('lapSplits').appendChild(d);
    });
    showScreen('finish');
  },

  setSoundIcon(muted) { $('btnSound').textContent = muted ? '🔇' : '🔊'; },
};

// ---- minimap ---------------------------------------------------------------
const mm = $('minimap');
const mg = mm.getContext('2d');
const MM_WORLD = 760;   // world metres from centre to edge

export function drawMinimap(course, boat, activeIdx, passedThisLap) {
  const W = mm.width, H = mm.height;
  const cx = W / 2, cy = H / 2;
  const s = (W / 2 - 6) / MM_WORLD;
  const X = (x) => cx + x * s;
  const Y = (z) => cy + z * s;

  mg.clearRect(0, 0, W, H);
  // water
  mg.fillStyle = 'rgba(10, 40, 60, 0.9)';
  mg.beginPath(); mg.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2); mg.fill();
  // island
  mg.fillStyle = '#3d5a3a';
  mg.strokeStyle = '#d8c48a';
  mg.lineWidth = 2;
  mg.beginPath();
  course.coast.forEach(([x, z], i) => (i ? mg.lineTo(X(x), Y(z)) : mg.moveTo(X(x), Y(z))));
  mg.closePath(); mg.fill(); mg.stroke();

  // course line
  mg.strokeStyle = 'rgba(140, 220, 255, 0.3)';
  mg.lineWidth = 1.5;
  mg.setLineDash([4, 5]);
  mg.beginPath();
  course.gates.forEach((g, i) => (i ? mg.lineTo(X(g.x), Y(g.z)) : mg.moveTo(X(g.x), Y(g.z))));
  mg.closePath(); mg.stroke();
  mg.setLineDash([]);

  // gates
  course.gates.forEach((g, i) => {
    const passed = passedThisLap.has(i);
    mg.fillStyle = i === activeIdx ? '#ffc84a' : passed ? '#5fd88a' : '#cfe6f5';
    mg.beginPath();
    mg.arc(X(g.x), Y(g.z), i === activeIdx ? 6 : 3.5, 0, Math.PI * 2);
    mg.fill();
    if (i === activeIdx) {
      mg.strokeStyle = 'rgba(255, 200, 74, 0.6)';
      mg.lineWidth = 2;
      mg.beginPath(); mg.arc(X(g.x), Y(g.z), 9, 0, Math.PI * 2); mg.stroke();
    }
  });

  // boat
  const bx = X(boat.pos.x), by = Y(boat.pos.z);
  mg.save();
  mg.translate(bx, by);
  mg.rotate(boat.heading);
  mg.fillStyle = '#ff5a48';
  mg.beginPath();
  mg.moveTo(8, 0); mg.lineTo(-6, 5); mg.lineTo(-6, -5);
  mg.closePath(); mg.fill();
  mg.restore();
}