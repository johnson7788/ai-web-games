// 程序化场景贴图：地面/草地图集（左半草地剖面、右半泥土），保证可无缝平铺
import * as THREE from 'three';

function rnd(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

export function makeGroundAtlas() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  const half = S / 2;

  // ---- 泥土（右半）
  ctx.fillStyle = '#8a6544';
  ctx.fillRect(half, 0, half, S);
  const r1 = rnd(7);
  for (let i = 0; i < 900; i++) {
    const x = half + r1() * half;
    const y = r1() * S;
    const s = 2 + r1() * 10;
    ctx.fillStyle = r1() > 0.5 ? 'rgba(110,78,50,.55)' : 'rgba(168,126,86,.45)';
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.7, r1() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 几块小石子
  for (let i = 0; i < 26; i++) {
    const x = half + r1() * half;
    const y = r1() * S;
    const r = 6 + r1() * 12;
    ctx.fillStyle = 'rgba(120,112,104,.55)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.7, r1(), 0, Math.PI * 2); ctx.fill();
  }

  // ---- 侧面剖面：只在顶部压一条暗边，避免出现"悬浮草带"
  ctx.fillStyle = 'rgba(40,26,16,.45)';
  ctx.fillRect(half, 0, half, S * 0.05);
  ctx.fillStyle = 'rgba(255,233,196,.10)';
  ctx.fillRect(half, S * 0.05, half, S * 0.02);

  // ---- 草地（左半）
  ctx.fillStyle = '#6f9a5a';
  ctx.fillRect(0, 0, half, S);
  const r2 = rnd(23);
  // 底部渐深，模拟土壤过渡
  const grad = ctx.createLinearGradient(0, S * 0.55, 0, S);
  grad.addColorStop(0, 'rgba(76,110,62,0)');
  grad.addColorStop(1, 'rgba(60,88,48,.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, S * 0.55, half, S * 0.45);
  // 草叶
  for (let i = 0; i < 420; i++) {
    const x = r2() * half;
    const y = r2() * S * 0.75;
    const h = 10 + r2() * 26;
    ctx.strokeStyle = r2() > 0.55 ? 'rgba(140,186,112,.75)' : 'rgba(88,128,70,.8)';
    ctx.lineWidth = 3 + r2() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (r2() - 0.5) * 10, y - h * 0.6, x + (r2() - 0.5) * 16, y - h);
    ctx.stroke();
  }
  // 零星小花
  for (let i = 0; i < 18; i++) {
    const x = r2() * half;
    const y = r2() * S * 0.6;
    ctx.fillStyle = r2() > 0.5 ? '#ffe9a8' : '#f4b6c2';
    ctx.beginPath(); ctx.arc(x, y, 4 + r2() * 3, 0, Math.PI * 2); ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 立方体：顶面用图集左半（草），其余面用右半（土） */
export function makeTopGrassBox() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    const u = uv.getX(i);
    const v = uv.getY(i);
    // 侧面/底面的 V 轴是反的，翻过来草带才会朝上
    uv.setXY(i, face === 2 ? u * 0.5 : 0.5 + u * 0.5, face === 2 ? v : 1 - v);
  }
  uv.needsUpdate = true;
  return geo;
}

/** 单张贴图的立方体（木箱等） */
export function makePlainBox() {
  return new THREE.BoxGeometry(1, 1, 1);
}

/** 纯色图集（低配/贴图缺失时兜底） */
export function makeSolidTexture(hex) {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 8;
  const ctx = c.getContext('2d');
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 8, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}


/** 纯泥土（内部瓦片用，避免每块都出现草带） */
export function makeDirtTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a6544';
  ctx.fillRect(0, 0, S, S);
  const r = rnd(91);
  for (let i = 0; i < 700; i++) {
    const x = r() * S;
    const y = r() * S;
    const s = 1 + r() * 6;
    ctx.fillStyle = r() > 0.5 ? 'rgba(110,78,50,.5)' : 'rgba(168,126,86,.4)';
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.7, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 20; i++) {
    const x = r() * S, y = r() * S, rr = 4 + r() * 8;
    ctx.fillStyle = 'rgba(120,112,104,.5)';
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.7, r(), 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
