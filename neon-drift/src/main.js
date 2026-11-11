import * as THREE from 'three';
import { CONFIG, TRACKS, T } from './config.js';
import { Track } from './track.js';
import { Car, CAR_SPECS, buildCarMesh } from './car.js';
import { Rival, Ghost } from './rivals.js';
import { GameAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

// 演示/调试参数：?laps=1&track=0
const QS = new URLSearchParams(location.search);
if (QS.has('laps')) CONFIG.laps = Math.max(1, Math.min(9, parseInt(QS.get('laps'), 10) || 3));

const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ---------------------------------------------------------------- 渲染器
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.75 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 4000);

// —— 灯光（主题会改颜色）——
const hemi = new THREE.HemisphereLight(0x9fd0ff, 0x241a34, 0.85);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd9b0, 2.8);
key.castShadow = true;
key.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
key.shadow.camera.near = 10; key.shadow.camera.far = 280;
key.shadow.camera.left = -70; key.shadow.camera.right = 70;
key.shadow.camera.top = 70; key.shadow.camera.bottom = -70;
key.shadow.bias = -0.0006;
scene.add(key);
scene.add(key.target);
const rim = new THREE.DirectionalLight(0x28e0ff, 1.8);
scene.add(rim);

const carFill = new THREE.PointLight(0xbfe6ff, 26, 28, 2);
scene.add(carFill);

const pmrem = new THREE.PMREMGenerator(renderer);
const skyCache = new Map();
const envCache = new Map();
let currentSkyUrl = null;
function getSky(url) {
  if (!skyCache.has(url)) {
    const tex = new THREE.TextureLoader().load(url, (t) => {
      // 天空加载完成后再烘环境贴图（否则 PMREM 会读到空 image）
      envCache.delete(url);
      if (currentSkyUrl === url) scene.environment = getEnv(url);
    });
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    skyCache.set(url, tex);
  }
  return skyCache.get(url);
}
function getEnv(url) {
  const sky = getSky(url);
  if (!sky.image) return null;
  if (!envCache.has(url)) envCache.set(url, pmrem.fromEquirectangular(sky).texture);
  return envCache.get(url);
}

// ---------------------------------------------------------------- 资源
const loader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function loadTex(url, { srgb = false, repeat = false } = {}) {
  const t = loader.load(url);
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const tex = {
  car0: loadTex('assets/car-0.jpg', { srgb: true }),
  car1: loadTex('assets/car-1.jpg', { srgb: true }),
  car2: loadTex('assets/car-2.jpg', { srgb: true }),
  carN: loadTex('assets/car-normal.png'),
  carORM: loadTex('assets/car-orm.png'),
  road: loadTex('assets/road-albedo.jpg', { srgb: true, repeat: true }),
  roadN: loadTex('assets/road-normal.png', { repeat: true }),
};

// ---------------------------------------------------------------- 世界
let world = null;
let track = null;
let trackIndex = -1;
let rivals = [];
let ghost = null;
let playerMesh = null;

const player = new Car();
let sel = { track: 0, car: 0 };
try {
  const s = JSON.parse(localStorage.getItem(CONFIG.appId + '_sel') || '{}');
  if (Number.isInteger(s.track) && s.track >= 0 && s.track < TRACKS.length) sel.track = s.track;
  if (Number.isInteger(s.car) && s.car >= 0 && s.car < CAR_SPECS.length) sel.car = s.car;
} catch { /* 忽略 */ }
if (QS.has('track')) sel.track = Math.max(0, Math.min(TRACKS.length - 1, parseInt(QS.get('track'), 10) || 0));

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh || o.isPoints) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m?.dispose?.());
    }
  });
}

function applyTheme(theme) {
  scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity ?? 0.003);
  currentSkyUrl = theme.sky;
  const sky = getSky(theme.sky);
  scene.background = sky;
  scene.backgroundIntensity = theme.bgIntensity ?? 1;
  const env = getEnv(theme.sky);
  scene.environment = env || null;
  hemi.color.setHex(theme.hemiSky);
  hemi.groundColor.setHex(theme.hemiGround);
  hemi.intensity = theme.hemi;
  key.color.setHex(theme.key);
  key.intensity = theme.keyI;
  rim.color.setHex(theme.rim);
  rim.intensity = theme.rimI;
  renderer.toneMappingExposure = theme.exposure ?? 1.2;
  carFill.color.setHex(theme.hemiSky);
  carFill.intensity = theme.fill ?? 20;
}

function buildWorld(i) {
  if (world) { scene.remove(world); disposeGroup(world); }
  trackIndex = i;
  world = new THREE.Group();
  scene.add(world);
  track = new Track(TRACKS[i], tex);
  track.build(world);
  track.addStartLine(world);
  applyTheme(TRACKS[i].theme);

  rivals.forEach((r) => scene.remove(r.mesh));
  rivals = [];
  if (ghost) { scene.remove(ghost.mesh); ghost = null; }
}

function buildPlayerMesh() {
  if (playerMesh) scene.remove(playerMesh);
  playerMesh = buildCarMesh(tex, { spec: sel.car });
  scene.add(playerMesh);
}

function buildRivals() {
  rivals.forEach((r) => scene.remove(r.mesh));
  rivals = [0, 1, 2].map((i) => {
    const spec = (sel.car + i + 1) % CAR_SPECS.length;
    const r = new Rival(track, tex, i, spec);
    scene.add(r.mesh);
    return r;
  });
}

function buildGhost() {
  if (ghost) scene.remove(ghost.mesh);
  ghost = new Ghost(track, tex, sel.car);
  scene.add(ghost.mesh);
}

// ---------------------------------------------------------------- 粒子
const PMAX = 160;
const pPos = new Float32Array(PMAX * 3);
const pCol = new Float32Array(PMAX * 3);
const pLife = new Float32Array(PMAX);
const pVel = new Float32Array(PMAX * 3);
for (let i = 0; i < PMAX; i++) { pLife[i] = 0; pPos[i * 3 + 1] = -999; }
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.45, 'rgba(255,255,255,.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 1.7, map: softDot(), transparent: true, opacity: 0.42, depthWrite: false,
  blending: THREE.NormalBlending, vertexColors: true, sizeAttenuation: true, toneMapped: true,
}));
points.frustumCulled = false;
scene.add(points);

let pIdx = 0;
function spawnParticle(x, y, z, color, spread = 1.2, life = 0.7) {
  const i = pIdx = (pIdx + 1) % PMAX;
  pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
  pCol[i * 3] = color.r; pCol[i * 3 + 1] = color.g; pCol[i * 3 + 2] = color.b;
  pVel[i * 3] = (Math.random() - 0.5) * spread;
  pVel[i * 3 + 1] = 0.6 + Math.random() * 1.4;
  pVel[i * 3 + 2] = (Math.random() - 0.5) * spread;
  pLife[i] = life;
}
function tickParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    pPos[i * 3] += pVel[i * 3] * dt;
    pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
    pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    pVel[i * 3 + 1] -= 1.2 * dt;
    if (pLife[i] <= 0) pPos[i * 3 + 1] = -999;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

// ---------------------------------------------------------------- 音效
const audio = new GameAudio();

// ---------------------------------------------------------------- 输入
const input = { steer: 0, drift: false, nitro: false, brake: false };
const keys = new Set();
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyR' && state === 'done') startRace();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

let touchSteer = 0, touchDrift = false, touchNitro = false;

function readInput() {
  if (window.__AUTO) {
    const a = window.__AUTO;
    input.steer = a.steer || 0; input.drift = !!a.drift;
    input.nitro = !!a.nitro; input.brake = !!a.brake;
    return;
  }
  input.steer = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) input.steer -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) input.steer += 1;
  input.drift = keys.has('Space') || touchDrift;
  input.nitro = keys.has('ShiftLeft') || keys.has('ShiftRight') || touchNitro;
  input.brake = keys.has('ArrowDown') || keys.has('KeyS');
  if (touchSteer) input.steer = touchSteer;
}

if (isTouch) {
  $('touch').classList.remove('hidden');
  document.querySelectorAll('#touch .steer').forEach((el) => {
    const dir = +el.dataset.steer;
    const on = (e) => { e.preventDefault(); touchSteer = dir; el.classList.add('active'); };
    const off = (e) => { e.preventDefault(); if (touchSteer === dir) touchSteer = 0; el.classList.remove('active'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  });
  const bind = (el, set) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('active'); set(true); });
    const up = (e) => { e.preventDefault(); el.classList.remove('active'); set(false); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  };
  bind($('btnDrift'), (v) => (touchDrift = v));
  bind($('btnNitro'), (v) => (touchNitro = v));
}

// ---------------------------------------------------------------- 状态
let state = 'title';
let cdT = 0;
let raceT = 0;
let lapStart = 0;
let lap = 1;
let lapTimes = [];
let tickCount = 0;
let shake = 0;
let boostGlow = 0;
const L = () => track.length;

function fmt(t) {
  if (!isFinite(t) || t <= 0) return '--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}'${s.toFixed(2).padStart(5, '0')}`;
}

function loadSave() {
  try { return JSON.parse(localStorage.getItem(CONFIG.appId + '_save') || '{}'); } catch { return {}; }
}
function writeSave(data) {
  try { localStorage.setItem(CONFIG.appId + '_save', JSON.stringify(data)); } catch { /* 忽略 */ }
}
const save = loadSave();
$('titleBest').textContent = save.bestLap ? fmt(save.bestLap) : '--';
$('best').textContent = save.bestLap ? fmt(save.bestLap) : '--';
$('laps').textContent = CONFIG.laps;
$('total').textContent = 4;
$('totalBig').textContent = 4;
$('hint').textContent = isTouch ? T('touchHint') : T('controls');
$('timeLabel').textContent = T('raceTime');

function resetActors() {
  player.reset(-10, 0);
  buildRivals();
  buildGhost();
  lap = 1;
  lapTimes = [];
  raceT = 0;
  lapStart = 0;
  tickCount = 0;
  if (ghost) {
    ghost.load(save.ghost && save.ghost.track === trackIndex ? save.ghost.frames : []);
    ghost.start();
  }
  updateHud();
}

function startRace() {
  if (trackIndex !== sel.track) buildWorld(sel.track);
  resetActors();
  audio.ensure();
  audio.resume();
  $('title').classList.add('hidden');
  $('results').classList.add('hidden');
  $('hud').classList.remove('hidden');
  state = 'countdown';
  cdT = 3.4;
  $('countdown').classList.remove('hidden');
  $('cdNum').textContent = '3';
  placeCar();
}

function finishRace() {
  state = 'done';
  audio.setEngine(0, false);
  audio.setSkid(false);
  const total = raceT;
  const bestLap = Math.min(...lapTimes.filter((x) => x > 0), Infinity);
  const isBest = !save.bestLap || bestLap < save.bestLap;
  if (isBest) {
    save.bestLap = bestLap;
    save.ghost = { track: trackIndex, frames: ghost ? ghost.frames.slice(0, 3600) : [] };
  }
  save.total = total;
  writeSave(save);

  $('rTotal').textContent = fmt(total);
  $('rBest').textContent = fmt(bestLap);
  $('rPos').textContent = stand().pos + ' / ' + (rivals.length + 1);
  $('rRecord').classList.toggle('hidden', !isBest);
  $('best').textContent = fmt(save.bestLap);
  $('titleBest').textContent = fmt(save.bestLap);
  $('results').classList.remove('hidden');
  $('countdown').classList.add('hidden');
}

function stand() {
  const list = [{ s: player.s, me: true }, ...rivals.map((r) => ({ s: r.s, me: false }))];
  list.sort((a, b) => b.s - a.s);
  return { pos: list.findIndex((x) => x.me) + 1, of: list.length };
}

// ---------------------------------------------------------------- HUD
const gaugeFill = $('gaugeFill');
const nitroSegs = [...document.querySelectorAll('#nitroBar .seg')];
function updateHud() {
  const kmh = Math.round(player.speed * 3.6);
  $('speed').textContent = kmh;
  const ratio = Math.min(1, player.speed / CONFIG.car.maxSpeed);
  gaugeFill.style.strokeDashoffset = String(377 * (1 - ratio * 0.92));
  $('time').textContent = fmt(raceT);
  $('lap').textContent = Math.min(lap, CONFIG.laps);
  const n = player.nitro / CONFIG.car.nitroMax;
  nitroSegs.forEach((s, i) => s.classList.toggle('on', n > (i + 0.15) / 5));
  $('nitroBar').parentElement.classList.toggle('ready', n >= 0.999);
  $('nitroNum').textContent = `${Math.min(5, Math.floor(n * 5))} / 5`;
  const st = stand();
  $('pos').textContent = st.pos;
  $('posBig').textContent = st.pos;
}

// ---------------------------------------------------------------- 主循环
const clock = new THREE.Clock();
let acc = 0;
let frameCount = 0;
let perfT = 0, perfN = 0, perfStage = 0;
const STEP = 1 / CONFIG.logicFps;

function degradeQuality(fps) {
  if (perfStage === 0) { renderer.setPixelRatio(1); perfStage = 1; console.warn('[perf] low fps', fps.toFixed(1), '→ pixelRatio 1'); }
  else if (perfStage === 1) { renderer.shadowMap.enabled = false; key.castShadow = false; perfStage = 2; console.warn('[perf] still low', fps.toFixed(1), '→ shadows off'); }
}

function tickLogic(dt) {
  readInput();
  if (state === 'countdown') {
    cdT -= dt;
    if (cdT > 0.4) {
      const label = String(Math.min(3, Math.max(1, Math.ceil(cdT - 0.4))));
      if ($('cdNum').textContent !== label) { $('cdNum').textContent = label; audio.beep(false); }
    } else if (cdT > 0) {
      if ($('cdNum').textContent !== 'GO') { $('cdNum').textContent = 'GO'; audio.beep(true); }
    } else {
      $('countdown').classList.add('hidden');
      state = 'race';
      raceT = 0; lapStart = 0;
    }
    audio.setEngine(0.12 + 0.1 * Math.abs(input.steer), false);
    return;
  }
  if (state !== 'race') return;

  raceT += dt;
  player.tick(dt, input, track);
  for (const ev of player.events) {
    if (ev === 'boostStart') { audio.boost(); boostGlow = 1; }
    if (ev === 'offTrack') { audio.crash(); shake = 0.55; }
  }
  rivals.forEach((r) => r.tick(dt, player.s));

  // 车与车轻微碰撞
  for (const r of rivals) {
    const ds = r.s - player.s;
    if (Math.abs(ds) < 3.4 && Math.abs(r.t - player.t) < 2.2) {
      const push = Math.sign(player.t - r.t) || 1;
      player.t += push * 3.0 * dt;
      player.speed *= 1 - 0.5 * dt;
      if (!player.touchCooldown) { player.touchCooldown = 0.4; audio.crash(); shake = Math.max(shake, 0.25); }
    }
  }
  player.touchCooldown = Math.max(0, (player.touchCooldown || 0) - dt);

  if (ghost) ghost.tick(dt);
  tickCount++;
  if (tickCount % 3 === 0 && ghost) ghost.record(player, tickCount);

  const currentLap = Math.floor(player.s / L()) + 1;
  if (currentLap > lap) {
    lapTimes.push(raceT - lapStart);
    lapStart = raceT;
    lap = currentLap;
    audio.lap();
    if (lap > CONFIG.laps) finishRace();
  }
  audio.setEngine(Math.min(1, player.speed / CONFIG.car.maxSpeed), player.boostT > 0);
  audio.setSkid(player.drifting, Math.min(1, Math.abs(player.angle) * 1.8));
}

const camLook = new THREE.Vector3();
const fwd = new THREE.Vector3();

function placeCar() {
  if (!playerMesh || !track) return;
  const w = player.world(track);
  playerMesh.position.copy(w);
  playerMesh.rotation.set(0, player.yaw(track), 0);
}

function tickVisual(dt) {
  const w = player.world(track);
  if (playerMesh) {
    playerMesh.position.copy(w);
    playerMesh.rotation.y = player.yaw(track);
    playerMesh.rotation.z = -player.angle * 0.35;
    playerMesh.userData.wheels.forEach((hub, i) => {
      hub.rotation.x += player.speed * dt * 2.2;
      if (i < 2) hub.rotation.y = -player.steerSmooth * 0.35;
    });
  }

  const yaw = player.yaw(track);
  fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  const camDist = CONFIG.camera.dist + (player.boostT > 0 ? 1.1 : 0) * (1 - boostGlow);
  const desired = new THREE.Vector3(w.x - fwd.x * camDist, w.y + CONFIG.camera.height, w.z - fwd.z * camDist);
  if (shake > 0.01) {
    desired.x += (Math.random() - 0.5) * shake;
    desired.y += (Math.random() - 0.5) * shake * 0.6;
    desired.z += (Math.random() - 0.5) * shake;
    shake *= Math.pow(0.02, dt);
  }
  camera.position.lerp(desired, 1 - Math.exp(-CONFIG.camera.posLerp * dt));
  camLook.lerp(w.clone().addScaledVector(fwd, CONFIG.camera.lookAhead).setY(w.y + 0.9), 1 - Math.exp(-CONFIG.camera.lookLerp * dt));
  camera.lookAt(camLook);

  const targetFov = CONFIG.camera.fovBase
    + Math.min(1, player.speed / CONFIG.car.maxSpeed) * CONFIG.camera.fovSpeed
    + (player.boostT > 0 ? CONFIG.camera.fovBoost : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();

  carFill.position.set(w.x - fwd.x * 3.2, 4.2, w.z - fwd.z * 3.2);
  key.position.set(w.x + 60, w.y + 90, w.z + 40);
  key.target.position.copy(w);

  if (player.drifting && Math.random() < 0.85) {
    const side = Math.sign(player.angle) || 1;
    spawnParticle(
      w.x - fwd.x * 1.6 + Math.cos(yaw) * side * 0.9, 0.25,
      w.z - fwd.z * 1.6 - Math.sin(yaw) * side * 0.9,
      new THREE.Color(0xcfdae4), 1.4, 0.55
    );
  }
  if (player.boostT > 0) {
    spawnParticle(w.x - fwd.x * 2.0, 0.55, w.z - fwd.z * 2.0, new THREE.Color(0x28e0ff), 0.7, 0.35);
  }
  tickParticles(dt);
  boostGlow = Math.max(0, boostGlow - dt * 1.6);
}

function loop() {
  frameCount++;
  const dt = Math.min(0.12, clock.getDelta());
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard++ < 12) { tickLogic(STEP); acc -= STEP; }
  if (state !== 'title') tickVisual(dt);
  updateHud();
  renderer.render(scene, camera);

  perfT += dt; perfN++;
  if (perfT > 1.6) {
    const fps = perfN / perfT;
    if (fps < 34) degradeQuality(fps);
    perfT = 0; perfN = 0;
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- 选择界面
function carSvg(spec) {
  const toX = (v) => 12 + ((v + 1) / 2) * 176;
  const toY = (v) => 66 - v * 44;
  const path = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${toX(x).toFixed(1)} ${toY(y).toFixed(1)}`).join(' ') + ' Z';
  const c = '#' + spec.accent.toString(16).padStart(6, '0');
  return `<svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet">
    <path d="${path(spec.body)}" fill="${c}" fill-opacity="0.16" stroke="${c}" stroke-width="2.5"/>
    <path d="${path(spec.cabin)}" fill="${c}" fill-opacity="0.32" stroke="${c}" stroke-width="1.5"/>
  </svg>`;
}

function buildCards() {
  const tc = $('trackCards');
  tc.innerHTML = '';
  TRACKS.forEach((t, i) => {
    const el = document.createElement('button');
    el.className = 'card' + (i === sel.track ? ' on' : '');
    el.innerHTML = `<img src="assets/card-${t.id}.jpg" alt="${t.cn}" onerror="this.src='assets/thumb-${t.id}.jpg'"><span>${t.cn}</span><em>${t.name}</em>`;
    el.onclick = () => { audio.ui(); selectTrack(i); };
    tc.appendChild(el);
  });
  const cc = $('carCards');
  cc.innerHTML = '';
  CAR_SPECS.forEach((c, i) => {
    const el = document.createElement('button');
    el.className = 'card car' + (i === sel.car ? ' on' : '');
    el.innerHTML = `${carSvg(c)}<span>${c.cn}</span><em>${c.name}</em>`;
    el.onclick = () => { audio.ui(); selectCar(i); };
    cc.appendChild(el);
  });
}

function selectTrack(i) {
  sel.track = i;
  try { localStorage.setItem(CONFIG.appId + '_sel', JSON.stringify(sel)); } catch { /* 忽略 */ }
  buildWorld(i);
  player.reset(-10, 0);
  placeCar();
  focusTitle();
  buildCards();
}

function selectCar(i) {
  sel.car = i;
  try { localStorage.setItem(CONFIG.appId + '_sel', JSON.stringify(sel)); } catch { /* 忽略 */ }
  buildPlayerMesh();
  placeCar();
  buildCards();
}

function focusTitle() {
  const w = player.world(track);
  camera.position.set(w.x, w.y + 4.2, w.z - 9.5);
  camLook.copy(w).setY(w.y + 0.9);
  camera.lookAt(camLook);
  camera.fov = 58;
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- 启动
$('btnStart').addEventListener('click', () => { audio.ui(); startRace(); });
$('btnRestart').addEventListener('click', () => { audio.ui(); startRace(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { keys.clear(); audio.stopAll(); }
});

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const s = Math.min(innerWidth / 960, innerHeight / 540);
  $('stage').style.transform = `scale(${s})`;
}
addEventListener('resize', resize);
resize();

buildWorld(sel.track);
buildPlayerMesh();
buildCards();
player.reset(-10, 0);
placeCar();
focusTitle();

window.__GAME = {
  player, startRace, input, CAR_SPECS, camera, scene, renderer,
  get playerMesh() { return playerMesh; },
  get rivals() { return rivals; },
  get track() { return track; },
  get ghost() { return ghost; },
  get state() { return state; },
  get cdT() { return cdT; },
  get raceT() { return raceT; },
  get frames() { return frameCount; },
  get sel() { return sel; },
};
state = 'title';
loop();
