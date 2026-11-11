// 分层纸偶角色 v3：13 层（头/躯干/钥匙 + 双侧 上臂/前臂/大腿/小腿/靴），肘膝可弯
// 美术：assets/character_v2/*.webp（AI 拆件 + rembg + 裁切）
// 关节：肩/髋/膝/踝都有 pivot；跑跳时用目标角度 + 指数平滑，避免"木棍人"式硬摆
import * as THREE from 'three';

const Z = {
  backArm: -0.020, backFore: -0.018,
  backLeg: -0.090, backShin: -0.088, backBoot: -0.086,
  key: -0.050,
  torso: 0,
  frontLeg: 0.070, frontShin: 0.072, frontBoot: 0.074,
  frontArm: 0.110, frontFore: 0.112,
  head: 0.140,
};

const HIP = 0.48;
const SHOULDER = 0.80;
const NECK = 0.785;

const ART_SIZE = {
  head: { w: 0.214, h: 0.225 },
  torso: { w: 0.197, h: 0.31 },
  armUpper: { w: 0.0586, h: 0.16 },
  armFore: { w: 0.0637, h: 0.16 },
  thigh: { w: 0.104, h: 0.23 },
  shin: { w: 0.08, h: 0.16 },
  boot: { w: 0.112, h: 0.09 },
  key: { w: 0.12, h: 0.17 },
};

const FAR = 0x8f7f70;

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const WOOD = '#c58f52';
const WOOD_DARK = '#9a6a37';
const VEST = '#b8382c';
const CREAM = '#ffe9c4';
const BRASS = '#d8a92b';

function limbTex() {
  return canvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = WOOD;
    roundRect(ctx, s * 0.36, s * 0.1, s * 0.28, s * 0.8, s * 0.14);
    ctx.fill();
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = s * 0.035;
    ctx.stroke();
  });
}

function headTex() {
  return canvasTex(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = WOOD;
    roundRect(ctx, s * 0.2, s * 0.28, s * 0.6, s * 0.56, s * 0.22);
    ctx.fill();
    ctx.strokeStyle = WOOD_DARK;
    ctx.lineWidth = s * 0.018;
    ctx.stroke();
    ctx.fillStyle = '#241a10';
    ctx.beginPath(); ctx.arc(s * 0.64, s * 0.55, s * 0.05, 0, Math.PI * 2); ctx.fill();
  });
}

function torsoTex() {
  return canvasTex(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = VEST;
    roundRect(ctx, s * 0.2, s * 0.14, s * 0.6, s * 0.78, s * 0.1);
    ctx.fill();
    ctx.fillStyle = BRASS;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(s * 0.5, s * (0.34 + i * 0.18), s * 0.028, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function keyTex() {
  return canvasTex(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = BRASS;
    ctx.strokeStyle = '#8a6a12';
    ctx.lineWidth = s * 0.02;
    roundRect(ctx, s * 0.44, s * 0.45, s * 0.12, s * 0.42, s * 0.03);
    ctx.fill(); ctx.stroke();
    for (const cx of [0.34, 0.66]) {
      ctx.beginPath();
      ctx.arc(s * cx, s * 0.34, s * 0.2, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(s * cx, s * 0.34, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  });
}

function plane(tex, w, h, z, tint) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  mat.toneMapped = false;
  if (tint) mat.color.set(tint);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.z = z;

  const edge = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    color: 0x1b1108, depthWrite: false,
  });
  edge.toneMapped = false;
  const outline = new THREE.Mesh(mesh.geometry, edge);
  outline.scale.setScalar(1.06);
  outline.position.z = -0.003;
  mesh.add(outline);
  return mesh;
}

/** 一段肢体：pivot 在顶端，mesh 向下挂 */
function segment(tex, w, h, z, tint) {
  const mesh = plane(tex, w, h, z, tint);
  // 纸片投影：往右下偏一点，让手臂/腿从马甲和天空里分出来
  const shadow = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    color: 0x160d06, opacity: 0.32, depthWrite: false,
  }));
  shadow.position.set(0.012, -0.012, -0.005);
  shadow.scale.setScalar(1.02);
  mesh.add(shadow);

  const g = new THREE.Group();
  mesh.position.y = -h / 2;
  g.add(mesh);
  return { g, mesh, h };
}

function makeArm(art, side, tint) {
  const upperTex = art?.armUpper?.texture || limbTex();
  const foreTex = art?.armFore?.texture || limbTex();
  const s = art ? ART_SIZE : {
    armUpper: { w: 0.07, h: 0.16 }, armFore: { w: 0.075, h: 0.16 },
  };
  const zU = side < 0 ? Z.backArm : Z.frontArm;
  const zF = side < 0 ? Z.backFore : Z.frontFore;

  const upper = segment(upperTex, s.armUpper.w, s.armUpper.h, zU, tint);
  upper.g.position.set(side * (side < 0 ? 0.088 : 0.072), SHOULDER, 0);
  const fore = segment(foreTex, s.armFore.w, s.armFore.h, zF, tint);
  fore.g.position.set(0, -upper.h + 0.02, 0.002);
  upper.g.add(fore.g);
  return { upper, fore };
}

function makeLeg(art, side, tint) {
  const thighTex = art?.thigh?.texture || limbTex();
  const shinTex = art?.shin?.texture || limbTex();
  const bootTex = art?.boot?.texture || limbTex();
  const s = art ? ART_SIZE : {
    thigh: { w: 0.09, h: 0.15 }, shin: { w: 0.085, h: 0.12 }, boot: { w: 0.14, h: 0.07 },
  };
  const zT = side < 0 ? Z.backLeg : Z.frontLeg;
  const zS = side < 0 ? Z.backShin : Z.frontShin;
  const zB = side < 0 ? Z.backBoot : Z.frontBoot;

  const thigh = segment(thighTex, s.thigh.w, s.thigh.h, zT, tint);
  thigh.g.position.set(side * 0.045, HIP, 0);

  const shin = segment(shinTex, s.shin.w, s.shin.h, zS, tint);
  shin.g.position.set(0, -thigh.h + 0.022, 0.002);
  thigh.g.add(shin.g);

  const boot = segment(bootTex, s.boot.w, s.boot.h, zB, tint);
  boot.g.position.set(0.014, -shin.h + 0.012, 0.002);
  boot.mesh.position.x = 0.012;
  shin.g.add(boot.g);

  return { thigh, shin, boot };
}

function setMap(mesh, tex) {
  if (!mesh || !tex || mesh.material.map === tex) return;
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
  const outline = mesh.children[0];
  if (outline && outline.material) {
    outline.material.map = tex;
    outline.material.needsUpdate = true;
  }
}

export function createCharacter(art = null) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const S = art ? ART_SIZE : {
    head: { w: 0.54, h: 0.46 }, torso: { w: 0.5, h: 0.36 },
    armUpper: { w: 0.17, h: 0.32 }, armFore: { w: 0.17, h: 0.16 },
    thigh: { w: 0.21, h: 0.17 }, shin: { w: 0.18, h: 0.12 }, boot: { w: 0.24, h: 0.12 },
    key: { w: 0.22, h: 0.22 },
  };
  const head = art ? art.head.texture : headTex();
  const torso = art ? art.torso.texture : torsoTex();
  const key = art ? (art.key?.texture || null) : keyTex();
  const far = art ? FAR : null;

  const backArm = makeArm(art, -1, far);
  const backLeg = makeLeg(art, -1, far);

  const torsoGrp = new THREE.Group();
  torsoGrp.position.y = HIP;
  const torsoMesh = plane(torso, S.torso.w, S.torso.h, 0);
  torsoMesh.position.y = S.torso.h / 2;
  torsoGrp.add(torsoMesh);

  let keyMesh = null;
  if (key) {
    keyMesh = plane(key, S.key.w, S.key.h, Z.key);
    keyMesh.position.set(-0.118, 0.17, Z.key);
    torsoGrp.add(keyMesh);
  }

  const frontLeg = makeLeg(art, 1, null);
  const frontArm = makeArm(art, 1, null);

  const headGrp = new THREE.Group();
  const headMesh = plane(head, S.head.w, S.head.h, Z.head);
  headMesh.position.y = S.head.h / 2;
  headMesh.scale.setScalar(1.03);
  headGrp.add(headMesh);
  headGrp.position.set(0, NECK, 0);

  body.add(backArm.upper.g, backLeg.thigh.g, torsoGrp, frontLeg.thigh.g, frontArm.upper.g, headGrp);

  const blobTex = canvasTex(64, (ctx, s2) => {
    const g = ctx.createRadialGradient(s2 / 2, s2 / 2, 0, s2 / 2, s2 / 2, s2 / 2);
    g.addColorStop(0, 'rgba(0,0,0,.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s2, s2);
  });
  const glowTex = canvasTex(64, (ctx, s2) => {
    const g = ctx.createRadialGradient(s2 / 2, s2 / 2, 0, s2 / 2, s2 / 2, s2 / 2);
    g.addColorStop(0, 'rgba(255,150,40,.85)');
    g.addColorStop(0.5, 'rgba(255,110,20,.35)');
    g.addColorStop(1, 'rgba(255,90,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s2, s2);
  });
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  glow.position.z = -0.16;
  root.add(glow);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 0.30),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);

  const bigHead = art?.headBig?.texture || null;
  const bigTorso = art?.torsoBig?.texture || null;
  const bigLimb = {
    upper: art?.armUpperBig?.texture || null,
    fore: art?.armForeBig?.texture || null,
    thigh: art?.thighBig?.texture || null,
    shin: art?.shinBig?.texture || null,
    boot: art?.bootBig?.texture || null,
  };
  let bigApplied = false;

  let phase = 0;
  let prevUF = 0;
  let prevUB = 0.5;
  let squash = 0;
  let wasGrounded = true;
  let state = 'idle';

  const cur = {
    hipF: 0, kneeF: 0, ankleF: 0, hipB: 0, kneeB: 0, ankleB: 0,
    shF: 0, elF: 0, shB: 0, elB: 0,
  };

  function legTarget(p, mode, side = 1, speed = 0) {
    if (mode === 'run') {
      // 周期步态：前摆腿伸直、后摆腿屈膝，踝关节反向补偿保持脚掌水平
      const sw = Math.sin(p);
      const hip = -sw * 0.46;
      const knee = 0.16 + Math.max(0, -sw) * 1.0;
      const ankle = -(hip + knee) * 0.8;
      return { hip, knee, ankle };
    }
    if (mode === 'rise') {
      const hip = -0.55, knee = 1.0;
      return { hip, knee, ankle: -(hip + knee) * 0.55 };
    }
    if (mode === 'fall') {
      const hip = -0.18, knee = 0.42;
      return { hip, knee, ankle: -(hip + knee) * 0.7 };
    }
    const b = Math.sin(phase * 0.6);
    return { hip: 0.015 * b, knee: 0.06, ankle: -0.03 };
  }

  function armTarget(p, mode, side) {
    if (mode === 'run') {
      const s = Math.sin(p + (side < 0 ? Math.PI : 0));
      return { sh: s * 0.48, el: 0.2 + Math.max(0, -s) * 0.55 };
    }
    if (mode === 'rise') return { sh: -1.05, el: 0.85 };
    if (mode === 'fall') return { sh: -0.5, el: 0.4 };
    return { sh: 0.04 + 0.02 * Math.sin(phase * 0.6), el: 0.14 };
  }

  return {
    group: root,
    get state() { return state; },
    update(dt, s) {
      const speed = Math.abs(s.vx);
      phase += dt * (4 + speed * 1.15);

      if (!wasGrounded && s.grounded && s.vy < -6) squash = 1;
      wasGrounded = s.grounded;
      squash = Math.max(0, squash - dt * 6);

      if (!s.grounded) state = s.vy > 1 ? 'rise' : 'fall';
      else state = speed > 0.4 ? 'run' : 'idle';

      if (state === 'run' && s.onFootstep) {
        const uF = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
        const uB = ((((phase + Math.PI) / (Math.PI * 2)) % 1) + 1) % 1;
        if (uF < prevUF) s.onFootstep(s.x + 0.08, s.y);
        if (uB < prevUB) s.onFootstep(s.x - 0.08, s.y);
        prevUF = uF; prevUB = uB;
      } else {
        prevUF = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
        prevUB = ((((phase + Math.PI) / (Math.PI * 2)) % 1) + 1) % 1;
      }

      if (s.big !== bigApplied) {
        bigApplied = s.big;
        if (bigHead) setMap(headMesh, s.big ? bigHead : head);
        if (bigTorso) setMap(torsoMesh, s.big ? bigTorso : torso);
        const arms = [frontArm, backArm];
        const legs = [frontLeg, backLeg];
        for (const a of arms) {
          if (bigLimb.upper) setMap(a.upper.mesh, s.big ? bigLimb.upper : art.armUpper.texture);
          if (bigLimb.fore) setMap(a.fore.mesh, s.big ? bigLimb.fore : art.armFore.texture);
        }
        for (const l of legs) {
          if (bigLimb.thigh) setMap(l.thigh.mesh, s.big ? bigLimb.thigh : art.thigh.texture);
          if (bigLimb.shin) setMap(l.shin.mesh, s.big ? bigLimb.shin : art.shin.texture);
          if (bigLimb.boot) setMap(l.boot.mesh, s.big ? bigLimb.boot : art.boot.texture);
          l.boot.mesh.scale.setScalar(s.big ? (bigLimb.boot ? 1.02 : 1.12) : 1);
        }
      }

      const mode = state;
      const tF = legTarget(phase, mode, 1, speed);
      const tB = legTarget(phase + Math.PI, mode, -1, speed);
      const aF = armTarget(phase, mode, 1);
      const aB = armTarget(phase, mode, -1);
      const k = 1 - Math.exp(-dt * 16);

      cur.hipF += (tF.hip - cur.hipF) * k;
      cur.kneeF += (tF.knee - cur.kneeF) * k;
      cur.ankleF += (tF.ankle - cur.ankleF) * k;
      cur.hipB += (tB.hip - cur.hipB) * k;
      cur.kneeB += (tB.knee - cur.kneeB) * k;
      cur.ankleB += (tB.ankle - cur.ankleB) * k;
      cur.shF += (aF.sh - cur.shF) * k;
      cur.elF += (aF.el - cur.elF) * k;
      cur.shB += (aB.sh - cur.shB) * k;
      cur.elB += (aB.el - cur.elB) * k;

      frontLeg.thigh.g.rotation.z = cur.hipF;
      frontLeg.shin.g.rotation.z = cur.kneeF;
      frontLeg.boot.g.rotation.z = cur.ankleF;
      backLeg.thigh.g.rotation.z = cur.hipB;
      backLeg.shin.g.rotation.z = cur.kneeB;
      backLeg.boot.g.rotation.z = cur.ankleB;

      frontArm.upper.g.rotation.z = cur.shF + 0.06;
      frontArm.fore.g.rotation.z = cur.elF;
      backArm.upper.g.rotation.z = cur.shB - 0.06;
      backArm.fore.g.rotation.z = cur.elB;

      const lean = state === 'run' ? Math.min(speed / 9, 1) * 0.18 : state === 'rise' ? -0.05 : 0.03;
      const bob = state === 'run'
        ? Math.abs(Math.cos(phase)) * 0.035
        : state === 'idle' ? Math.sin(phase * 0.6) * 0.008 : 0;

      const stretch = state === 'rise' ? 1.06 : 1;
      const sy = (1 - squash * 0.16) * stretch;
      const sx = 1 + squash * 0.12;
      body.scale.set(sx, sy, 1);
      root.position.set(s.x, s.y + bob, 0);

      const K = 1.7;
      const bigK = s.big ? 1.42 : 1;
      root.scale.set((s.facing >= 0 ? 1 : -1) * K * bigK, K * bigK, 1);

      torsoGrp.rotation.z = -lean * 0.8;
      headGrp.rotation.z = lean * 0.5 + Math.sin(phase) * (state === 'run' ? 0.04 : 0.01);
      headGrp.scale.setScalar(s.big ? 1.05 : 1);
      torsoMesh.scale.set(s.big ? 1.10 : 1, 1, 1);
      if (keyMesh) keyMesh.rotation.z = Math.sin(phase * 0.8) * 0.08;

      glow.visible = !!s.fire;
      if (glow.visible) glow.scale.setScalar(0.9 + Math.sin(phase * 3) * 0.06);

      if (s.shadowY != null) {
        shadow.visible = true;
        shadow.position.y = s.shadowY - s.y + 0.02;
        const drop = Math.max(0, s.y - s.shadowY);
        const kk = 1 / (1 + drop * 0.35);
        shadow.scale.set(kk, kk, 1);
        shadow.material.opacity = 0.55 * kk;
      } else {
        shadow.visible = false;
      }
    },
  };
}
