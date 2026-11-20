import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OceanSim, defaultOceanParams } from '../water/OceanSim.js';
import { OceanSurface } from '../water/OceanSurface.js';
import { bakeShoreMap } from '../water/shoreMap.js';
import { bakeWaterTextures } from '../water/bakeTextures.js';
import { SkySystem } from '../scene/sky.js';
import { createTerrain, heroRock } from '../scene/terrain.js';
import { islandHeight } from '../scene/islandHeight.js';
import { PlanarReflection } from '../engine/PlanarReflection.js';
import { PostFX } from '../engine/PostFX.js';
import { GpuTimer } from '../engine/gpuTimer.js';
import { FullscreenQuad, rawPass } from '../engine/fullscreen.js';
import { WaterQuery } from '../water/WaterQuery.js';
import { UnderwaterPass } from '../water/UnderwaterPass.js';
import { Spray } from '../water/Spray.js';
import { MarineSnow } from '../water/MarineSnow.js';
import { FloaterShadow } from '../scene/floaterShadow.js';
import { WaveCaustics } from '../water/Caustics.js';
import { Boat, BOAT_CONST } from './boat.js';
import { buildCourse, LAPS } from './course.js';
import { Wake } from './wake.js';
import { initInput, input, onKey, press, clearInput } from './input.js';
import { initAudio, setMuted, isMuted, engineUpdate, engineIdle, sfx } from './audio.js';
import { ui, showScreen, hideScreens, fmtTime, drawMinimap } from './ui.js';

const REFLECT_LAYER = 1;
const MEDALS = { gold: 210, silver: 260, bronze: 340 };
const t = (s) => (window.I18N ? window.I18N.t(s) : s);

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({
  antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'high-performance',
});
renderer.domElement.id = 'sea';
renderer.autoClear = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
const gl = renderer.getContext();
renderer.capabilities.maxTextures = gl.getParameter(WebGL2RenderingContext.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
document.body.prepend(renderer.domElement);

const args = new URLSearchParams(location.search);
const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = dbgExt ? String(gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL)) : '';
const software = /swiftshader|llvmpipe|softpipe|software/i.test(gpuName);
const mobile = args.has('mobile') || (!args.has('desktop') && matchMedia('(pointer: coarse)').matches);
const low = software || args.has('low');
const quality = low
  ? { resolution: 0.45, msaa: 2, reflections: false, reflectionScale: 0.25, autoResolution: true, shadow: 512, bloom: 0, simSkip: 2 }
  : mobile
    ? { resolution: 0.6, msaa: 2, reflections: true, reflectionScale: 0.35, autoResolution: true, shadow: 2048, bloom: 0 }
    : { resolution: 1, msaa: 4, reflections: true, reflectionScale: 0.5, autoResolution: false, shadow: 2048, bloom: 0.05 };
document.body.classList.toggle('mobile', mobile);

const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 80000);
const debugOrbit = args.has('debug');
const controls = debugOrbit ? new OrbitControls(camera, renderer.domElement) : null;
if (controls) { controls.enableDamping = true; controls.maxDistance = 6000; controls.target.set(0, 0, 0); }

// ---------------------------------------------------------------- world
let sky, shore, ocean, caustics, floatShadow, surface, scene, terrain, sunLight;
let boat, boatScene, course, wake, query, underwater, reflection, emptyReflection;
let waterScene, spray, snow, post, hdrRT, restore, collisionRocks;
const timer = new GpuTimer(gl);
let elapsed = 0, camWater = 0, wasSubmerged = false, uwComp = 1;
let sunDirty = true;
let simAccum = 0, frameCount = 0;

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function buildWorld() {
  ui.setLoading(true, 'Loading the ocean…');
  await nextFrame();

  sky = new SkySystem(renderer);
  Object.assign(sky.params, { elevation: 22, azimuth: 205, cloudCoverage: 0.32, turbidity: 2 });

  shore = bakeShoreMap(islandHeight, 1800, 512, (x, z) => {
    const q = ((x - heroRock.x) ** 2 + (z - heroRock.z) ** 2) / (8.5 * 8.5);
    return q < 1 ? 4 * (1 - q) : -Infinity;
  });
  ui.setLoading(true, 'Baking waves…');
  await nextFrame();

  const tex = bakeWaterTextures(renderer);
  ocean = new OceanSim(renderer, defaultOceanParams());
  caustics = new WaveCaustics(renderer, ocean);
  floatShadow = new FloaterShadow(low ? 512 : 1024);
  surface = new OceanSurface(ocean, shore, sky, floatShadow.uniforms);
  surface.uniforms.uFoamTex.value = tex.foam;

  scene = new THREE.Scene();
  scene.environment = sky.cube;
  scene.add(sky.background);
  terrain = createTerrain({
    sky, caustics: caustics.uniforms, floatShadow: floatShadow.uniforms, water: surface.uniforms,
    absorption: surface.uniforms.uAbsorption.value, reflectionLayer: REFLECT_LAYER,
  });
  scene.add(terrain.group);
  surface.uniforms.uRock.value.set(heroRock.x, heroRock.z, 8.5, 0);
  collisionRocks = [...terrain.shoreRocks, { x: heroRock.x, z: heroRock.z, r: 8.5 }];

  sunLight = new THREE.DirectionalLight(0xffffff, Math.PI);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(quality.shadow, quality.shadow);
  Object.assign(sunLight.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 5000 });
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.6;
  scene.add(sunLight, sunLight.target);
  surface.uniforms.uShadowMatrix.value = terrain.uniforms.uSunShadowMatrix.value = sunLight.shadow.matrix;
  surface.uniforms.uShadowBias.value = 0.05 / (sunLight.shadow.camera.far - sunLight.shadow.camera.near);
  ui.setLoading(true, 'Raising the island…');
  await nextFrame();

  boat = new Boat(terrain.patchProp);
  boatScene = new THREE.Scene();
  scene.add(boatScene);
  boatScene.add(boat.group);
  course = buildCourse(scene, islandHeight, collisionRocks);
  wake = new Wake();

  query = new WaterQuery(renderer, surface, 512);
  underwater = new UnderwaterPass(surface, camera, caustics.uniforms);
  reflection = new PlanarReflection(REFLECT_LAYER);
  surface.uniforms.uReflMatrix.value = reflection.textureMatrix;
  emptyReflection = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  emptyReflection.needsUpdate = true;

  waterScene = new THREE.Scene();
  restore = new FullscreenQuad(rawPass(/* glsl */`
precision highp float;
uniform sampler2D uTex;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(uTex, vUv); }`, { uTex: { value: null } }));
  restore.mesh.renderOrder = -1;
  if (/OculusBrowser/.test(navigator.userAgent)) waterScene.add(restore.mesh);
  spray = new Spray(surface, shore, [...terrain.shoreRocks, { x: heroRock.x, z: heroRock.z, r: 8.5 }]);
  snow = new MarineSnow(surface);
  waterScene.add(surface.mesh, spray.mesh, spray.splash, spray.rockSplash, snow.mesh, wake.mesh);

  post = new PostFX(renderer);
  post.params.bloomStrength = quality.bloom;
  post.params.bloomThreshold = 1.5;

  resize();
  applySun();
  resetBoatToStart();
  course.setActive(1);
  // one warm-up frame so shaders compile behind the loading screen
  renderFrame(1 / 60);
  await nextFrame();
}

function applySun() {
  sky.update();
  sunLight.position.copy(sky.sunDir).multiplyScalar(2000);
  sunLight.color.setRGB(sky.sunColor.x, sky.sunColor.y, sky.sunColor.z).multiplyScalar(1 / Math.max(sky.sunColor.x, 1e-4));
  sunLight.intensity = Math.PI * Math.max(sky.sunColor.x, 1e-4);
  renderer.shadowMap.needsUpdate = true;
  sunDirty = false;
}

function makeTargets() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  hdrRT?.dispose();
  hdrRT = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType, samples: quality.msaa, generateMipmaps: false,
    depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.FloatType),
  });
  restore.material.uniforms.uTex.value = hdrRT.texture;
  surface.uniforms.uSceneColor.value = hdrRT.texture;
  surface.uniforms.uSceneDepth.value = hdrRT.depthTexture;
  surface.uniforms.uResolution.value.copy(size);
  reflection.scale = quality.reflectionScale;
  reflection.setSize(size.x, size.y);
  post.setSize(size.x, size.y);
  underwater.setSize(size.x, size.y);
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.5) * quality.resolution);
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  makeTargets();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- race state
const G = {
  mode: 'loading',
  lap: 1, cp: 0, activeGate: 1, gatesPassedTotal: 0,
  raceTime: 0, lapStart: 0, splits: [],
  gateBudget: 30, gateLeft: 30, prevGateS: -1,
  boosting: false, boostTimer: 0, boostCooldown: 0,
  best: null, camShake: 0, wrongWayT: 0,
  countdownT: 0, lastCd: 99, lastTick: 99,
  camMode: 0, orbitA: 0,
  passedThisLap: new Set(),
  impactSlot: 0, impactLast: 0, impacts: [],
  hitSfxAt: -9,
};

function loadBest() {
  try {
    const v = window.PipySDK ? window.PipySDK.load('best', null) : null;
    return typeof v === 'number' && isFinite(v) ? v : null;
  } catch { return null; }
}
function saveBest(v) {
  try { window.PipySDK?.save('best', v); } catch { /* private mode */ }
}

function startPos() {
  const g0 = course.gates[0];
  return { x: g0.x - g0.nx * 26, z: g0.z - g0.nz * 26 };
}
function resetBoatToStart() {
  const g0 = course.gates[0], g1 = course.gates[1];
  const s = startPos();
  boat.reset(s.x, s.z, Math.atan2(g1.z - s.z, g1.x - s.x));
}

function gateBudgetFor(lap) {
  const gPrev = course.gates[(G.activeGate + course.gates.length - 1) % course.gates.length];
  const g = course.gates[G.activeGate];
  const dist = Math.hypot(g.x - gPrev.x, g.z - gPrev.z);
  const factor = lap === 1 ? 1 : lap === 2 ? 0.95 : 0.9;
  return THREE.MathUtils.clamp(dist / 16 + 12, 20, 45) * factor;
}

function activateGate(i) {
  G.activeGate = i;
  course.setActive(i);
  G.gateBudget = gateBudgetFor(G.lap);
  G.gateLeft = G.gateBudget;
  const g = course.gates[i];
  G.prevGateS = (boat.pos.x - g.x) * g.nx + (boat.pos.z - g.z) * g.nz;
  G.lastTick = 99;
}

function startRace() {
  initAudio();
  clearInput();
  resetBoatToStart();
  G.lap = 1; G.cp = 0; G.gatesPassedTotal = 0;
  G.raceTime = 0; G.lapStart = 0; G.splits = [];
  G.boosting = false; G.boostTimer = 0; G.boostCooldown = 0;
  G.camShake = 0; G.wrongWayT = 0; G.passedThisLap.clear();
  G.countdownT = 3.4; G.lastCd = 99;
  G.impacts.length = 0;
  ocean.params.windSpeed = 9; ocean.dirty = true;
  activateGate(1);
  G.mode = 'countdown';
  hideScreens();
  ui.setHudVisible(true);
  ui.wrongWay(false);
  snapCamera();
  try { window.PipySDK?.newRun({ game: 'tideline' }); } catch { /* noop */ }
}

function toTitle() {
  G.mode = 'title';
  clearInput();
  resetBoatToStart();
  course.setActive(1);
  hideScreens();
  showScreen('title');
  ui.setHudVisible(false);
  ui.hideCountdown();
  ui.setBestTitle(G.best);
  engineIdle();
}

function passGate() {
  const g = course.gates[G.activeGate];
  G.cp++; G.gatesPassedTotal++;
  G.passedThisLap.add(G.activeGate);
  sfx.checkpoint();
  ui.flash();
  wake.burst(g.x, 0.4, g.z, 40, 2);
  ui.toast(`${t('CHECKPOINT')} ${G.cp}/${course.gates.length}`, 'gold');

  if (G.activeGate === 0) {
    // lap complete
    G.splits.push(G.raceTime - G.lapStart);
    G.lapStart = G.raceTime;
    if (G.lap >= LAPS) { finishRace(); return; }
    G.lap++;
    G.cp = 0;
    G.passedThisLap.clear();
    sfx.lap();
    ocean.params.windSpeed = 9 + (G.lap - 1) * 2.5;
    ocean.dirty = true;
    ui.toast(`${t('LAP')} ${G.lap}/${LAPS} — ${t(G.lap === 2 ? 'THE SEA IS BUILDING' : 'BIG WAVES!')}`, 'cyan');
    activateGate(1);
  } else {
    activateGate((G.activeGate + 1) % course.gates.length);
  }
}

function finishRace() {
  G.mode = 'finished';
  const total = G.raceTime;
  const medal = total <= MEDALS.gold ? 'gold' : total <= MEDALS.silver ? 'silver' : total <= MEDALS.bronze ? 'bronze' : 'none';
  const isRecord = G.best == null || total < G.best;
  if (isRecord) { G.best = total; saveBest(total); }
  ui.showFinish({ time: total, best: G.best, isRecord, medal, splits: G.splits });
  ui.setHudVisible(false);
  ui.wrongWay(false);
  sfx.win();
  engineIdle();
  try { window.PipySDK?.levelCleared({ time: total, medal }); } catch { /* noop */ }
}

function failRace() {
  G.mode = 'failed';
  showScreen('fail');
  ui.setHudVisible(false);
  ui.wrongWay(false);
  sfx.fail();
  engineIdle();
  try { window.PipySDK?.gameOver({ lap: G.lap, cp: G.cp }); } catch { /* noop */ }
}

function togglePause() {
  if (G.mode === 'racing') {
    G.mode = 'paused';
    showScreen('pause');
    clearInput();
    engineIdle();
  } else if (G.mode === 'paused') {
    G.mode = 'racing';
    hideScreens();
  }
}

// ---------------------------------------------------------------- camera
const camPos = new THREE.Vector3(700, 90, 0);
const camLook = new THREE.Vector3(0, 20, 0);
const _desired = new THREE.Vector3(), _look = new THREE.Vector3();

function snapCamera() {
  const fx = Math.cos(boat.heading), fz = Math.sin(boat.heading);
  camPos.set(boat.pos.x - fx * 13.5, boat.y + 5.8, boat.pos.z - fz * 13.5);
  camLook.set(boat.pos.x + fx * 9, boat.y + 1.6, boat.pos.z + fz * 9);
}

function updateCamera(dt) {
  if (debugOrbit && controls) { controls.update(); return; }
  if (G.mode === 'title' || G.mode === 'loading') {
    const a = elapsed * 0.05;
    _desired.set(Math.cos(a) * 780, 95, Math.sin(a) * 780);
    _look.set(0, 15, 0);
    camPos.lerp(_desired, Math.min(1, dt * 1.2));
    camLook.lerp(_look, Math.min(1, dt * 1.2));
  } else if (G.camMode === 1) {
    G.orbitA += dt * 0.22;
    _desired.set(boat.pos.x + Math.cos(G.orbitA) * 26, boat.y + 11, boat.pos.z + Math.sin(G.orbitA) * 26);
    _look.set(boat.pos.x, boat.y + 1.5, boat.pos.z);
    camPos.lerp(_desired, Math.min(1, dt * 3));
    camLook.lerp(_look, Math.min(1, dt * 5));
  } else {
    const fx = Math.cos(boat.heading), fz = Math.sin(boat.heading);
    const dist = G.camMode === 2 ? 27 : 13.5;
    const height = G.camMode === 2 ? 16 : 5.8;
    _desired.set(boat.pos.x - fx * dist, boat.y + height, boat.pos.z - fz * dist);
    _look.set(boat.pos.x + fx * 9, boat.y + 1.6, boat.pos.z + fz * 9);
    camPos.lerp(_desired, Math.min(1, dt * 3.6));
    camLook.lerp(_look, Math.min(1, dt * 5));
  }
  camera.position.copy(camPos);
  if (G.camShake > 0.002) {
    camera.position.x += (Math.random() - 0.5) * G.camShake;
    camera.position.y += (Math.random() - 0.5) * G.camShake;
    camera.position.z += (Math.random() - 0.5) * G.camShake;
    G.camShake *= Math.exp(-dt * 5);
  }
  // stay above the waves
  const floor = camWater + 1.7;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.lookAt(camLook);
  camera.rotateZ(-boat.roll * 0.22);
  const speedN = Math.min(1, boat.speed / BOAT_CONST.MAX_SPEED);
  const targetFov = 55 + speedN * 7 + (G.boosting ? 4 : 0);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }
}

// ---------------------------------------------------------------- water query plumbing
const boatPts = new Float32Array(8);
const allPts = new Float32Array(512 * 2);
const impacts = G.impacts;

function submitWaterQuery() {
  let k = 0;
  allPts[k++] = camera.position.x; allPts[k++] = camera.position.z;
  boat.samplePoints(boatPts);
  for (let i = 0; i < 8; i++) allPts[k++] = boatPts[i];
  const bp = course.collectBuoyPoints();
  for (let i = 0; i < bp.length; i++) allPts[k++] = bp[i];
  query.submit(allPts, k / 2, 1, elapsed);
}

function ingestWaterQuery() {
  if (query.resultCount < 5) return;
  camWater = query.result[0];
  boat.ingestWater(query.result, 1);
}

// ---------------------------------------------------------------- render
function renderFrame(dt) {
  elapsed += dt;
  if (sunDirty) applySun();
  timer.beginFrame();

  // boat sun-shadow on the water (also primes the compare-mode depth texture —
  // without a first render every material sampling it would fail its draw)
  floatShadow.update(renderer, boatScene, [{ pos: boat.group.position, radius: 4.5 }], sky.sunDir);

  // boat ripple rings on the real surface (8 impact slots)
  const su = surface.uniforms;
  for (let i = 0; i < 8; i++) {
    const e = impacts[i];
    const age = e ? elapsed - e.t : 1e9;
    su.uImpact.value[i].set(e?.x ?? 0, e?.z ?? 0, age, e && age < 25 ? e.amp : 0);
    su.uImpactSize.value[i] = e?.size ?? 1;
  }

  // FFT sim + caustics: on software renderers run every other frame (the 16 IFFT
  // passes dominate); accumulated dt keeps wave speed correct
  simAccum += dt;
  frameCount++;
  if (!quality.simSkip || frameCount % quality.simSkip === 0) {
    ocean.update(simAccum, timer);
    simAccum = 0;
    timer.begin('caustics');
    caustics.update(sky.sunDir);
  }
  surface.update(camera, elapsed % 3600);
  spray.update();
  course.update(elapsed, query.result, 5, query.resultCount);
  wake.update(elapsed);
  timer.begin('query');
  submitWaterQuery();

  const camY = camera.position.y;
  const submerged = camY < camWater - 0.3, nearSurface = camY < camWater + 1.2;
  su.uCamSide.value = camY > camWater + 0.5 ? -1 : camY < camWater - 0.5 ? 1 : 0;
  snow.update(camera, hdrRT.height, nearSurface);
  uwComp += ((submerged ? 0.55 : 1) - uwComp) * Math.min(1, dt * 3);
  post.params.exposure = uwComp;
  post.params.droplets = wasSubmerged && !submerged ? 1 : submerged ? 0 : Math.max(0, post.params.droplets - dt / 5);
  wasSubmerged = submerged;

  timer.begin('reflection');
  if (quality.reflections && !submerged) {
    reflection.render(renderer, scene, camera);
    su.uReflection.value = reflection.target.texture;
  } else su.uReflection.value = emptyReflection;

  timer.begin('opaque');
  renderer.setRenderTarget(hdrRT);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, false);
  renderer.render(scene, camera);

  timer.begin('water');
  su.uShadowMap.value = sunLight.shadow.map.depthTexture;
  hdrRT.resolveDepthBuffer = nearSurface;
  renderer.render(waterScene, camera);
  hdrRT.resolveDepthBuffer = true;

  let frame = hdrRT.texture;
  if (nearSurface) {
    timer.begin('underwater');
    frame = underwater.render(renderer, hdrRT, camY < camWater - 0.8);
  }

  timer.begin('post');
  post.render(frame, dt);
  timer.endFrame();
}

// ---------------------------------------------------------------- autopilot (test aid)
let autopilot = false;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function runAutopilot() {
  const g = course.gates[G.activeGate];
  const dx = g.x - boat.pos.x, dz = g.z - boat.pos.z;
  const dist = Math.hypot(dx, dz);
  let desired = Math.atan2(dz, dx);
  // shallow-water avoidance: look 30 m ahead, bias toward deeper water
  const fx = Math.cos(boat.heading), fz = Math.sin(boat.heading);
  const ax = boat.pos.x + fx * 30, az = boat.pos.z + fz * 30;
  if (islandHeight(ax, az) > -2.5) {
    const lx = boat.pos.x + (fx * 0.7 - fz * 0.7) * 30, lz = boat.pos.z + (fz * 0.7 + fx * 0.7) * 30;
    const rx = boat.pos.x + (fx * 0.7 + fz * 0.7) * 30, rz = boat.pos.z + (fz * 0.7 - fx * 0.7) * 30;
    desired = islandHeight(lx, lz) < islandHeight(rx, rz)
      ? Math.atan2(lz - boat.pos.z, lx - boat.pos.x)
      : Math.atan2(rz - boat.pos.z, rx - boat.pos.x);
  }
  const diff = wrapPi(desired - boat.heading);
  const steer = THREE.MathUtils.clamp(diff * 3, -1, 1);
  press('left', steer < -0.12);
  press('right', steer > 0.12);
  press('gas', true);
  press('boost', Math.abs(diff) < 0.12 && dist > 160 && G.boostCooldown <= 0 && !G.boosting);
}

function stopAutopilot() {
  autopilot = false;
  for (const a of ['left', 'right', 'gas', 'boost']) press(a, false);
}

// ---------------------------------------------------------------- HUD
function updateHud() {
  const g = course.gates[G.activeGate];
  const dx = g.x - boat.pos.x, dz = g.z - boat.pos.z;
  const dist = Math.hypot(dx, dz);
  const fx = Math.cos(boat.heading), fz = Math.sin(boat.heading);
  const fwd = dx * fx + dz * fz;
  const lat = dx * -fz + dz * fx;
  ui.setStats(G.lap, G.cp, G.raceTime, G.best);
  ui.setSpeed(boat.speed * 1.944);
  const fuel = G.boosting ? G.boostTimer / 2.2 : G.boostCooldown > 0 ? 1 - G.boostCooldown / 6 : 1;
  ui.setBoost(fuel, G.boostCooldown > 0, G.boosting);
  ui.setGateTimer(G.gateLeft / G.gateBudget, G.gateLeft < G.gateBudget * 0.3);
  ui.setGateDist(dist, Math.atan2(lat, fwd));
  drawMinimap(course, boat, G.activeGate, G.passedThisLap);
}

// ---------------------------------------------------------------- main loop
let last = performance.now(), frames = 0, fpsWindow = performance.now(), fps = 0;
const auto = { n: -240, missed: 0, clean: 0, top: quality.resolution };

function autoResolution(ms) {
  if (ms > 250) return;
  if (++auto.n <= 0) return;
  if (ms > 24) auto.missed++;
  if (auto.n < 120) return;
  const r = quality.resolution, miss = auto.missed / auto.n;
  auto.n = auto.missed = 0;
  if (miss > 0.05 && r > 0.35) {
    quality.resolution = Math.round((r - 0.05) * 20) / 20;
    auto.clean = 0;
    resize();
    auto.n = -60;
  } else if (miss <= 0.01 && ++auto.clean >= 3 && r < auto.top) {
    auto.clean = 0;
    quality.resolution = Math.round((r + 0.05) * 20) / 20;
    resize();
    auto.n = -60;
  }
}

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.2);
  last = now;

  // ---- state machine
  if (G.mode === 'countdown') {
    G.countdownT -= dt;
    const cd = Math.ceil(G.countdownT);
    if (cd !== G.lastCd && cd > 0) { G.lastCd = cd; ui.countdown(String(cd)); sfx.count(); }
    if (G.countdownT <= 0) {
      G.mode = 'racing';
      ui.countdown('GO!');
      sfx.go();
      setTimeout(() => ui.hideCountdown(), 650);
    }
  } else if (G.mode === 'racing') {
    G.raceTime += dt;
    G.gateLeft -= dt;
    if (G.gateLeft <= 5 && Math.ceil(G.gateLeft) !== G.lastTick) { G.lastTick = Math.ceil(G.gateLeft); if (G.lastTick > 0) sfx.tick(); }
    if (G.gateLeft <= 0) { failRace(); }

    // boost
    if (input.boost && !G.boosting && G.boostCooldown <= 0) {
      G.boosting = true; G.boostTimer = 2.2; sfx.boost();
    }
    if (G.boosting) {
      G.boostTimer -= dt;
      if (G.boostTimer <= 0 || !input.boost) { G.boosting = false; G.boostCooldown = 6; }
    } else if (G.boostCooldown > 0) {
      G.boostCooldown = Math.max(0, G.boostCooldown - dt);
    }

    if (autopilot) runAutopilot();

    // physics (two substeps for stability on slow frames)
    const steps = 2, h = dt / steps;
    let impact = 0;
    for (let i = 0; i < steps; i++) {
      impact = Math.max(impact, boat.step(h, input, G.boosting, islandHeight, collisionRocks));
    }
    if (impact > 2.5 && elapsed - G.hitSfxAt > 0.4) {
      G.hitSfxAt = elapsed;
      sfx.hit();
      wake.splash(boat.pos.x, boat.y, boat.pos.z, 26);
      G.camShake = Math.min(0.6, impact * 0.05);
    }
    if (impact > 8 && boat.hitCooldown <= 0) {
      boat.hitCooldown = 1.5;
      G.raceTime += 2;
      ui.toast(t('+2s COLLISION PENALTY'), 'red');
    }

    // wake + ripple rings
    wake.boatWake(boat, G.boosting);
    if (boat.speed > 8 && elapsed - G.impactLast > 0.45) {
      G.impactLast = elapsed;
      const fx = Math.cos(boat.heading), fz = Math.sin(boat.heading);
      impacts[G.impactSlot % 8] = {
        x: boat.pos.x - fx * 3.5, z: boat.pos.z - fz * 3.5, t: elapsed,
        amp: Math.min(0.2, 0.02 + boat.speed * 0.003), size: 2.4,
      };
      G.impactSlot++;
    }

    // gate crossing
    const g = course.gates[G.activeGate];
    const rx = boat.pos.x - g.x, rz = boat.pos.z - g.z;
    const s = rx * g.nx + rz * g.nz;
    const lat = rx * g.dx + rz * g.dz;
    const crossed = (G.prevGateS < 0 && s >= 0 && Math.abs(lat) <= g.width * 0.5 + 4) || Math.hypot(rx, rz) < 9;
    G.prevGateS = s;
    if (crossed) passGate();

    // wrong-way hint
    const dl = Math.hypot(g.x - boat.pos.x, g.z - boat.pos.z) || 1;
    const toward = (boat.vel.x * (g.x - boat.pos.x) + boat.vel.y * (g.z - boat.pos.z)) / dl;
    G.wrongWayT = toward < -4 ? G.wrongWayT + dt : Math.max(0, G.wrongWayT - dt * 2);
    ui.wrongWay(G.wrongWayT > 2);

    engineUpdate(Math.min(1, boat.speed / BOAT_CONST.MAX_SPEED), Math.max(0, input.throttle), G.boosting);
    updateHud();
  } else if (G.mode === 'title' || G.mode === 'countdown' || G.mode === 'paused') {
    // boat keeps bobbing at the start line; no control
    boat.step(dt, { throttle: 0, steer: 0 }, false, islandHeight, collisionRocks);
    if (G.mode === 'countdown') updateHud();
  }

  ingestWaterQuery();
  updateCamera(dt);
  renderFrame(dt);

  frames++;
  if (now - fpsWindow > 1000) { fps = Math.round((frames * 1000) / (now - fpsWindow)); frames = 0; fpsWindow = now; }
}

function loop(now) {
  if (quality.autoResolution) autoResolution(now - last);
  tick(now);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- boot
initInput();
onKey((e) => {
  if (G.mode === 'loading') return;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  else if (e.code === 'KeyR' && G.mode !== 'title') startRace();
  else if (e.code === 'KeyC') { G.camMode = (G.camMode + 1) % 3; ui.toast(t(['CHASE CAMERA', 'ORBIT CAMERA', 'HIGH CAMERA'][G.camMode]), 'cyan'); }
  else if (e.code === 'KeyM') { ui.setSoundIcon(setMuted(!isMuted())); }
});

document.getElementById('btnStart').addEventListener('click', startRace);
document.getElementById('btnPause').addEventListener('click', togglePause);
document.getElementById('btnResume').addEventListener('click', togglePause);
document.getElementById('btnRestartP').addEventListener('click', startRace);
document.getElementById('btnAgain').addEventListener('click', startRace);
document.getElementById('btnRetry').addEventListener('click', startRace);
document.getElementById('btnQuitP').addEventListener('click', toTitle);
document.getElementById('btnMenuF').addEventListener('click', toTitle);
document.getElementById('btnMenuX').addEventListener('click', toTitle);
document.getElementById('btnSound').addEventListener('click', () => { initAudio(); ui.setSoundIcon(setMuted(!isMuted())); });

G.best = loadBest();
ui.setBestTitle(G.best);
ui.setSoundIcon(isMuted());

// test / debug hook (real key events, real physics)
window.__tideline = {
  get state() {
    return {
      mode: G.mode, lap: G.lap, cp: G.cp, activeGate: G.activeGate,
      gatesPassedTotal: G.gatesPassedTotal, raceTime: G.raceTime, gateLeft: G.gateLeft,
      speed: boat?.speed ?? 0, x: boat?.pos.x ?? 0, z: boat?.pos.z ?? 0,
      heading: boat?.heading ?? 0, fps, gpu: gpuName, software,
      quality: { ...quality },
    };
  },
  press,
  start: startRace,
  autopilot(on) { if (on) autopilot = true; else stopAutopilot(); },
  course: () => course?.gates.map((g) => ({ x: g.x, z: g.z })),
};

buildWorld().then(() => {
  ui.setLoading(false);
  G.mode = 'title';
  showScreen('title');
  last = performance.now();
  requestAnimationFrame(loop);
}).catch((err) => {
  console.error(err);
  ui.setLoading(true, 'Failed to start: ' + (err?.message || err));
});