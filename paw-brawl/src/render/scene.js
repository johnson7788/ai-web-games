import * as THREE from 'three';
import { CONFIG } from '../../config/game.config.js';
import { CLOUD_RING } from '../../config/arenas.js';
import { CHARACTERS } from '../../config/characters.js';

const gradient = new THREE.DataTexture(new Uint8Array([104, 182, 255]), 3, 1, THREE.RedFormat);
gradient.minFilter = THREE.NearestFilter;
gradient.magFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...extra });
const noise = (index) => ((Math.sin(index * 12.9898) * 43758.5453) % 1 + 1) % 1;

export function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (!object.material) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      if (material.map) textures.add(material.map);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function makeArenaTexture(arena) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = arena.palette.surface;
  ctx.fillRect(0, 0, 512, 512);
  if (arena.id === 'candy-works') {
    ctx.fillStyle = '#FFB6D2';
    ctx.fillRect(0, 0, 512, 512);
    ctx.save();
    ctx.translate(256, 256);
    ctx.rotate(-Math.PI / 4);
    for (let stripe = -12; stripe <= 12; stripe++) {
      ctx.fillStyle = stripe % 2 ? '#FFF4F8' : '#FF8FBC';
      ctx.fillRect(stripe * 58 - 24, -720, 34, 1440);
    }
    ctx.restore();
    const colors = ['#FFFFFF', '#FF8FBC', '#C96B9E', '#FFD166', '#B99CFF'];
    for (let index = 0; index < 130; index++) {
      const x = noise(index * 3) * 512;
      const y = noise(index * 3 + 1) * 512;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(noise(index * 3 + 2) * Math.PI);
      ctx.fillStyle = colors[index % colors.length];
      ctx.globalAlpha = 0.38;
      ctx.fillRect(-7, -2, 14, 4);
      ctx.restore();
    }
  } else if (arena.id === 'frozen-lake') {
    ctx.strokeStyle = 'rgba(38, 122, 180, .44)';
    ctx.lineWidth = 2.4;
    for (let index = 0; index < 24; index++) {
      const x = noise(index * 4) * 512;
      const y = noise(index * 4 + 1) * 512;
      const branchX = x + (noise(index * 4 + 2) - 0.5) * 95;
      const branchY = y + 35;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(branchX, branchY);
      ctx.lineTo(x + (noise(index * 4 + 3) - 0.5) * 120, y + 80);
      ctx.moveTo(branchX, branchY);
      ctx.lineTo(branchX + (index % 2 ? 30 : -30), branchY + 18);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.32)';
    for (let index = 0; index < 70; index++) {
      ctx.beginPath();
      ctx.arc(noise(index * 2) * 512, noise(index * 2 + 1) * 512, 1 + noise(index + 90) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = 'rgba(211, 157, 119, 0.24)';
    ctx.lineWidth = 3;
    for (const radius of [174, 216]) {
      ctx.beginPath();
      ctx.arc(256, 256, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 122, 89, 0.12)';
    ctx.beginPath();
    ctx.ellipse(256, 270, 23, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, r] of [[234, 245, 9], [250, 235, 10], [268, 237, 10], [282, 250, 9]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(107, 91, 149, 0.18)';
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      ctx.beginPath();
      ctx.arc(256 + Math.sin(angle) * 195, 256 + Math.cos(angle) * 195, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeSky(arena) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(arena.palette.sky1) },
      bottomColor: { value: new THREE.Color(arena.palette.sky2) },
      horizonColor: { value: new THREE.Color(arena.id === 'frozen-lake' ? '#7EE0C0' : arena.palette.surface) },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 horizonColor;
      varying vec3 vDirection;
      void main() {
        float h = normalize(vDirection).y;
        vec3 sky = mix(bottomColor, topColor, smoothstep(-0.18, 0.72, h));
        float horizon = exp(-pow((h + 0.02) * 5.0, 2.0)) * 0.28;
        gl_FragColor = vec4(mix(sky, horizonColor, horizon), 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(105, 32, 18), material);
  sky.renderOrder = -100;
  return sky;
}

function makeCloud(index) {
  const group = new THREE.Group();
  const material = toon(index % 3 === 0 ? '#FFF4E7' : '#F5FCFF');
  const geo = new THREE.SphereGeometry(1, 10, 7);
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(geo, material);
    puff.position.set((i - 2) * 0.75, Math.abs(i - 2) * -0.12 + noise(index + i) * 0.35, noise(index * 4 + i) * 0.4);
    const scale = 0.75 + noise(index * 8 + i) * 0.65;
    puff.scale.set(scale, scale * 0.68, scale * 0.82);
    group.add(puff);
  }
  return group;
}

function makeIsland(index) {
  const group = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 0.45, 3.4, 9), toon(index ? '#A9B5D0' : '#91A9C7'));
  rock.position.y = -1.7;
  group.add(rock);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.1, 0.35, 12), toon(index ? '#C2DFD1' : '#B7D9C7'));
  top.position.y = 0.05;
  group.add(top);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.8, 7), toon('#967887'));
  trunk.position.set(-0.45, 0.55, 0);
  group.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.5, 8), toon('#7EB3AD'));
  crown.position.set(-0.45, 1.45, 0);
  group.add(crown);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.45, 7), toon('#F4B65F'));
  pole.position.set(0.75, 0.82, 0);
  group.add(pole);
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([0.75, 1.48, 0, 1.5, 1.27, 0, 0.75, 1.05, 0], 3));
  flagGeo.computeVertexNormals();
  group.add(new THREE.Mesh(flagGeo, toon(index ? '#FFD166' : '#FF7A59', { side: THREE.DoubleSide })));
  return group;
}

function makeCloudArena(arena) {
  const group = new THREE.Group();
  const platform = new THREE.Group();
  group.add(platform);
  const side = toon(arena.palette.side);
  const cream = toon(arena.palette.surface);
  const bottom = toon('#D96558');
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(arena.radius, arena.radius, arena.thickness, 72), [side, cream, bottom]);
  disk.position.y = -arena.thickness * 0.5;
  disk.receiveShadow = true;
  platform.add(disk);

  const underside = new THREE.Mesh(new THREE.CylinderGeometry(7.7, 2.4, 4.1, 14), toon('#E88978'));
  underside.position.y = -2.6;
  platform.add(underside);
  const undersideBand = new THREE.Mesh(new THREE.TorusGeometry(7.25, 0.16, 8, 64), toon(arena.palette.rim));
  undersideBand.rotation.x = Math.PI / 2;
  undersideBand.position.y = -1;
  platform.add(undersideBand);

  const top = new THREE.Mesh(new THREE.CircleGeometry(arena.radius - 0.06, 72), toon('#FFFFFF', { map: makeArenaTexture(arena) }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.012;
  top.receiveShadow = true;
  platform.add(top);

  const brickGeometry = new THREE.BoxGeometry(4.5, 0.32, 0.18);
  const bricks = [];
  for (let i = 0; i < CONFIG.scene.edgeSegments; i++) {
    const angle = i * Math.PI * 2 / CONFIG.scene.edgeSegments;
    const brick = new THREE.Mesh(brickGeometry, toon(i % 2 ? '#FFD9AE' : arena.palette.surface));
    brick.position.set(Math.sin(angle) * 9.01, -0.22, Math.cos(angle) * 9.01);
    brick.rotation.y = angle;
    group.add(brick);
    bricks.push(brick);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(arena.radius, 0.12, 10, 72), toon(arena.palette.rim));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.015;
  rim.castShadow = true;
  platform.add(rim);

  const flagColors = ['#FF7A59', '#7EE0C0', '#FFD166', '#8FD3FF'];
  const postRadius = 8.45;
  const posts = [];
  for (let i = 0; i < CONFIG.scene.postCount; i++) {
    const angle = i * Math.PI * 2 / CONFIG.scene.postCount;
    const post = new THREE.Group();
    post.position.set(Math.sin(angle) * postRadius, 0, Math.cos(angle) * postRadius);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.10, CONFIG.scene.postHeight, 12), toon('#F4B65F'));
    pole.position.y = CONFIG.scene.postHeight * 0.5;
    pole.castShadow = true;
    post.add(pole);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), cream);
    cap.position.y = CONFIG.scene.postHeight + 0.04;
    post.add(cap);
    group.add(post);
    posts.push(post);
  }

  const flags = [];
  const buntingGeometry = new THREE.BufferGeometry();
  buntingGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.46, 0], 3));
  buntingGeometry.computeVertexNormals();
  for (let i = 0; i < CONFIG.scene.postCount; i++) {
    const startAngle = i * Math.PI * 2 / CONFIG.scene.postCount;
    const endAngle = (i + 1) * Math.PI * 2 / CONFIG.scene.postCount;
    const points = [];
    for (let j = 0; j <= 16; j++) {
      const ratio = j / 16;
      const angle = startAngle + (endAngle - startAngle) * ratio;
      points.push(new THREE.Vector3(Math.sin(angle) * postRadius, 1.5 - Math.sin(ratio * Math.PI) * 0.28, Math.cos(angle) * postRadius));
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#6B5B95', transparent: true, opacity: 0.65 })));
    for (let j = 0; j < CONFIG.scene.flagsPerSpan; j++) {
      const ratio = (j + 1) / (CONFIG.scene.flagsPerSpan + 1);
      const angle = startAngle + (endAngle - startAngle) * ratio;
      const flag = new THREE.Mesh(buntingGeometry, toon(flagColors[j % flagColors.length], { side: THREE.DoubleSide }));
      flag.position.set(Math.sin(angle) * postRadius, 1.5 - Math.sin(ratio * Math.PI) * 0.28, Math.cos(angle) * postRadius);
      flag.rotation.y = angle;
      group.add(flag);
      flags.push({ mesh: flag, baseY: flag.position.y, phase: i * 0.7 + j });
    }
  }

  const balloons = [];
  const balloonGeometry = new THREE.SphereGeometry(1, 16, 12);
  const stringGeometry = new THREE.CylinderGeometry(0.008, 0.008, 1.4, 5);
  const stringMaterial = new THREE.MeshBasicMaterial({ color: '#6B5B95', transparent: true, opacity: 0.55 });
  for (let i = 0; i < CONFIG.scene.balloonGroups; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2;
    const bunch = new THREE.Group();
    bunch.position.set(Math.sin(angle) * 10.1, 1.65, Math.cos(angle) * 10.1);
    for (let j = 0; j < 3; j++) {
      const x = (j - 1) * 0.48;
      const y = j === 1 ? 0.38 : 0;
      const balloon = new THREE.Mesh(balloonGeometry, toon(CHARACTERS[(i * 2 + j) % CHARACTERS.length].colors.fur));
      balloon.position.set(x, y, 0);
      balloon.scale.set(0.32, 0.42, 0.32);
      bunch.add(balloon);
      const string = new THREE.Mesh(stringGeometry, stringMaterial);
      string.position.set(x, y - 1.02, 0);
      bunch.add(string);
    }
    group.add(bunch);
    balloons.push({ group: bunch, baseY: bunch.position.y, phase: i * 1.4 });
  }

  const springs = [];
  const springPads = [];
  for (const spring of arena.springs) {
    const pad = new THREE.Group();
    pad.position.set(spring.x, 0.04, spring.z);
    pad.rotation.y = spring.rotation;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.70, 0.76, 0.14, 24), toon('#6B5B95'));
    base.position.y = 0.07;
    base.castShadow = true;
    pad.add(base);
    for (const x of [-0.42, 0.42]) {
      for (const z of [-0.42, 0.42]) {
        const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), toon(arena.palette.rim));
        coil.position.set(x, 0.25, z);
        pad.add(coil);
      }
    }
    const surface = new THREE.Group();
    surface.position.y = 0.39;
    const topPad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.10, 24), cream);
    topPad.castShadow = true;
    surface.add(topPad);
    const bandMaterial = toon(arena.palette.side);
    const bandA = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.025, 0.10), bandMaterial);
    bandA.position.y = 0.065;
    surface.add(bandA);
    const bandB = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.025, 1.02), bandMaterial);
    bandB.position.y = 0.065;
    surface.add(bandB);
    pad.add(surface);
    group.add(pad);
    springs.push(surface);
    springPads.push(pad);
  }

  function setBounds({ radius }) {
    const ratio = radius / arena.radius;
    const progress = 1 - ratio;
    disk.scale.set(ratio, 1, ratio);
    for (const object of [top, rim, undersideBand]) object.scale.set(ratio, ratio, 1);
    bricks.forEach((brick, index) => {
      brick.position.y = -0.22 - progress * (2.2 + (index % 3) * 0.45);
      brick.rotation.z = progress * (index % 2 ? 0.35 : -0.35);
    });
    for (const post of posts) post.visible = progress < 0.35;
    for (const flag of flags) flag.mesh.visible = progress < 0.35;
    springPads.forEach((pad, index) => { pad.visible = Math.hypot(arena.springs[index].x, arena.springs[index].z) < radius; });
  }

  return { group, springs, flags, balloons, setBounds };
}

function makeConveyorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#583522';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = -64; y < 320; y += 48) {
    ctx.fillStyle = '#FFE0A3';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y + 42);
    ctx.lineTo(128, y + 56);
    ctx.lineTo(0, y + 14);
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 4);
  return texture;
}

function makeCandyCane(height = 1.5) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, height, 12), toon('#FFF6F0'));
  pole.position.y = height * 0.5;
  group.add(pole);
  for (let index = 0; index < 5; index++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.028, 5, 12), toon('#FF6F9F'));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.18 + index * height / 5;
    group.add(band);
  }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 8, 20, Math.PI), toon('#FFF6F0'));
  hook.position.set(0.28, height, 0);
  hook.rotation.z = Math.PI / 2;
  group.add(hook);
  return group;
}

function makeCandyFactory() {
  const group = new THREE.Group();
  const steam = [];
  const wallColors = ['#C65E96', '#DB7DA4', '#9D68A0'];
  for (let index = 0; index < 3; index++) {
    const factory = new THREE.Group();
    factory.position.set((index - 1) * 8.5, -1.5, -13.5 - index % 2 * 1.5);
    const building = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2 + index * 0.4, 3.4), toon(wallColors[index]));
    building.position.y = 1.6 + index * 0.2;
    factory.add(building);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 1.4, 4), toon(index % 2 ? '#70466F' : '#82456F'));
    roof.position.y = 3.9 + index * 0.4;
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.65;
    factory.add(roof);
    for (const x of [-2.1, 2.1]) {
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 0.08), new THREE.MeshBasicMaterial({ color: '#FFE49A', toneMapped: false }));
      window.position.set(x, 1.8, 1.74);
      factory.add(window);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.65, 0.1), toon('#633D68'));
    door.position.set(0, 0.84, 1.76);
    factory.add(door);
    for (const x of [-2.2, 1.8]) {
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 2.8, 10), toon('#76506F'));
      chimney.position.set(x, 4.2 + index * 0.4, 0);
      factory.add(chimney);
      for (let puff = 0; puff < 3; puff++) {
        const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.58 + puff * 0.14, 9, 6), new THREE.MeshBasicMaterial({ color: '#FFF4FB', transparent: true, opacity: 0.42, depthWrite: false }));
        cloud.position.set(x + puff * 0.28, 6 + index * 0.4 + puff * 0.8, 0);
        factory.add(cloud);
        steam.push({ mesh: cloud, baseX: cloud.position.x, baseY: cloud.position.y, phase: index + puff * 0.8 });
      }
    }
    group.add(factory);
  }
  for (const x of [-13, 13]) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.4, 16), toon('#F3B5CF', { transparent: true, opacity: 0.82 }));
    jar.position.set(x, 0.3, -11);
    group.add(jar);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 0.35, 16), toon('#FFD166'));
    lid.position.set(x, 2.15, -11);
    group.add(lid);
  }
  return { group, steam };
}

function makeCandyArena(arena) {
  const group = new THREE.Group();
  const platform = new THREE.Group();
  group.add(platform);
  const base = new THREE.Mesh(new THREE.BoxGeometry(arena.width, arena.thickness, arena.depth), toon(arena.palette.side));
  base.position.y = -arena.thickness * 0.5;
  base.receiveShadow = true;
  platform.add(base);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(arena.width - 0.05, arena.depth - 0.05), toon('#FFFFFF', { map: makeArenaTexture(arena) }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.012;
  top.receiveShadow = true;
  platform.add(top);
  const underside = new THREE.Mesh(new THREE.BoxGeometry(arena.width * 0.82, 2.8, arena.depth * 0.72), toon('#9E568B'));
  underside.position.y = -1.8;
  platform.add(underside);

  const wallMaterial = toon(arena.palette.rim);
  for (const z of [-arena.depth * 0.5, arena.depth * 0.5]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(arena.width, 0.32, 0.18), wallMaterial);
    wall.position.set(0, 0.16, z);
    platform.add(wall);
  }
  for (const x of [-arena.width * 0.5, arena.width * 0.5]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, arena.depth), wallMaterial);
    wall.position.set(x, 0.16, 0);
    platform.add(wall);
  }

  const conveyor = arena.hazards.find((hazard) => hazard.type === 'conveyor');
  const conveyorTexture = makeConveyorTexture();
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(conveyor.width - 0.12, conveyor.depth - 0.25), new THREE.MeshToonMaterial({ map: conveyorTexture, gradientMap: gradient }));
  belt.rotation.x = -Math.PI / 2;
  belt.position.set(conveyor.x, 0.028, conveyor.z);
  platform.add(belt);
  for (const x of [-conveyor.width * 0.5, conveyor.width * 0.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, conveyor.depth), toon('#FFD166'));
    rail.position.set(x, 0.055, 0);
    platform.add(rail);
  }

  const sweepers = [];
  for (const hazard of arena.hazards.filter((item) => item.type === 'sweeper')) {
    const sweeper = new THREE.Group();
    sweeper.position.set(hazard.x, 0, hazard.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.38, 1.05, 18), toon('#B99CFF'));
    pole.position.y = 0.52;
    pole.castShadow = true;
    sweeper.add(pole);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(hazard.radius, hazard.radius, hazard.length, 16), toon('#FFF4F8'));
    bar.rotation.x = Math.PI / 2;
    bar.position.y = 0.48;
    bar.castShadow = true;
    sweeper.add(bar);
    for (let index = 0; index < 7; index++) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(hazard.radius + 0.012, 0.055, 6, 16), toon(index % 2 ? '#FF6F9F' : '#FFD166'));
      stripe.position.set(0, 0.48, -hazard.length * 0.43 + index * hazard.length * 0.86 / 6);
      sweeper.add(stripe);
    }
    group.add(sweeper);
    sweepers.push({ group: sweeper, hazard });
  }

  for (const [x, z] of [[-11.2, -7.1], [11.2, -7.1], [-11.2, 7.1], [11.2, 7.1]]) {
    const cane = makeCandyCane(1.4);
    cane.position.set(x, -0.35, z);
    cane.scale.setScalar(0.72);
    group.add(cane);
  }
  const candyGeometry = new THREE.SphereGeometry(1, 16, 12);
  for (let index = 0; index < 8; index++) {
    const candy = new THREE.Mesh(candyGeometry, toon(['#FF8FBC', '#B99CFF', '#FFD166'][index % 3]));
    const side = index % 2 ? 1 : -1;
    candy.position.set(side * (12 + noise(index) * 5), -0.3 + noise(index + 4) * 2.2, (index - 3.5) * 3.1);
    candy.scale.set(0.7, 0.7, 0.32);
    candy.rotation.y = noise(index + 10) * Math.PI;
    group.add(candy);
  }
  const pipe = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.34, 12, 28, Math.PI * 1.4), toon('#B99CFF'));
  pipe.position.set(-12, 1.4, -5);
  pipe.rotation.set(0, 0.5, 0.2);
  group.add(pipe);
  const factory = makeCandyFactory();
  group.add(factory.group);

  function update(time, hazardTime) {
    conveyorTexture.offset.y = -hazardTime * conveyor.speed * 0.12;
    for (const { group: sweeper, hazard } of sweepers) sweeper.rotation.y = hazard.phase + hazardTime * hazard.angularSpeed;
    for (const puff of factory.steam) {
      puff.mesh.position.y = puff.baseY + Math.sin(time * 0.55 + puff.phase) * 0.45;
      puff.mesh.position.x = puff.baseX + Math.sin(time * 0.3 + puff.phase) * 0.25;
    }
  }
  function setBounds({ width, depth }) {
    platform.scale.set(width / arena.width, 1, depth / arena.depth);
  }
  return { group, update, setBounds };
}

function makePine() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 1.1, 7), toon('#52677B'));
  trunk.position.y = 0.55;
  group.add(trunk);
  for (let index = 0; index < 3; index++) {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.85 - index * 0.15, 1.35, 8), toon(index % 2 ? '#2B7B83' : '#276777'));
    crown.position.y = 1.15 + index * 0.62;
    group.add(crown);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(0.87 - index * 0.15, 0.38, 8), toon('#E8FBFF'));
    snow.position.y = crown.position.y + 0.46;
    group.add(snow);
  }
  return group;
}

function makePenguin() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 9), toon('#26334D'));
  body.scale.set(0.75, 1.25, 0.65);
  body.position.y = 0.72;
  group.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 9), toon('#E8FBFF'));
  belly.scale.set(0.65, 1.1, 0.25);
  belly.position.set(0, 0.65, 0.38);
  group.add(belly);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 8), toon('#F4B65F'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 1.12, 0.53);
  group.add(beak);
  return group;
}

function makeAuroraTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const rgb = new THREE.Color(color);
  const red = Math.round(rgb.r * 255);
  const green = Math.round(rgb.g * 255);
  const blue = Math.round(rgb.b * 255);
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, `rgba(${red},${green},${blue},0)`);
  gradient.addColorStop(0.35, `rgba(${red},${green},${blue},.7)`);
  gradient.addColorStop(0.68, `rgba(${red},${green},${blue},.42)`);
  gradient.addColorStop(1, `rgba(${red},${green},${blue},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFrozenArena(arena) {
  const group = new THREE.Group();
  const platform = new THREE.Group();
  group.add(platform);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(arena.radius, arena.radius * 0.96, arena.thickness, 72), toon(arena.palette.side));
  disk.position.y = -arena.thickness * 0.5;
  disk.receiveShadow = true;
  platform.add(disk);
  const top = new THREE.Mesh(new THREE.CircleGeometry(arena.radius - 0.04, 72), toon('#FFFFFF', { map: makeArenaTexture(arena) }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.015;
  top.receiveShadow = true;
  platform.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(arena.radius, 0.12, 10, 72), toon(arena.palette.rim));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.025;
  platform.add(rim);
  const snowGeometry = new THREE.SphereGeometry(1, 12, 8);
  const snowMaterial = toon('#F4FDFF');
  for (let index = 0; index < 18; index++) {
    const angle = index * Math.PI * 2 / 18;
    const pile = new THREE.Mesh(snowGeometry, snowMaterial);
    pile.position.set(Math.sin(angle) * 9.72, 0.04, Math.cos(angle) * 9.72);
    pile.scale.set(0.72 + noise(index) * 0.4, 0.18 + noise(index + 4) * 0.12, 0.55);
    pile.rotation.y = angle;
    platform.add(pile);
  }

  for (let index = 0; index < 11; index++) {
    const angle = index * Math.PI * 2 / 11 + 0.2;
    const radius = 12.5 + noise(index) * 5;
    const pine = makePine();
    pine.position.set(Math.sin(angle) * radius, -0.2, Math.cos(angle) * radius);
    pine.scale.setScalar(0.8 + noise(index + 20) * 0.7);
    group.add(pine);
  }
  for (let index = 0; index < 9; index++) {
    const angle = index * Math.PI * 2 / 9;
    const floe = new THREE.Mesh(new THREE.CylinderGeometry(1.1 + noise(index), 1 + noise(index) * 0.8, 0.28, 7), toon(index % 2 ? '#CFEFFF' : '#E8FBFF'));
    floe.position.set(Math.sin(angle) * (14 + noise(index + 9) * 9), -0.65, Math.cos(angle) * (14 + noise(index + 9) * 9));
    floe.rotation.y = noise(index + 40) * Math.PI;
    group.add(floe);
    if (index === 4 || index === 5) {
      const penguin = makePenguin();
      penguin.position.copy(floe.position);
      penguin.position.y += 0.18;
      penguin.rotation.y = -angle + 0.4;
      group.add(penguin);
    }
  }
  const aurora = [];
  for (let index = 0; index < 3; index++) {
    const geometry = new THREE.PlaneGeometry(34, 4.5, 48, 1);
    const positions = geometry.attributes.position;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = positions.getX(vertex);
      positions.setY(vertex, positions.getY(vertex) + Math.sin(x * 0.27 + index * 1.7) * 1.2);
    }
    positions.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({
      map: makeAuroraTexture(['#62FFD1', '#62C8FF', '#B99CFF'][index]), transparent: true, opacity: 0.72,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false,
    });
    const ribbon = new THREE.Mesh(geometry, material);
    ribbon.position.set(0, 0.6 + index * 0.65, -17 - index * 1.2);
    ribbon.rotation.z = -0.08 + index * 0.05;
    group.add(ribbon);
    aurora.push(ribbon);
  }
  const snow = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 12), new THREE.MeshBasicMaterial({ color: '#DDF7FF', transparent: true, opacity: 0.10, side: THREE.BackSide, depthWrite: false }));
  snow.scale.y = 0.18;
  snow.position.y = -4;
  group.add(snow);

  function update(time) {
    aurora.forEach((ribbon, index) => {
      ribbon.material.opacity = 0.68 + Math.sin(time * 0.35 + index) * 0.08;
      ribbon.position.x = Math.sin(time * 0.08 + index) * 2;
    });
  }
  function setBounds({ radius }) {
    const ratio = radius / arena.radius;
    disk.scale.set(ratio, 1, ratio);
    for (const object of [top, rim]) object.scale.set(ratio, ratio, 1);
  }
  return { group, update, setBounds };
}

function autoLow() {
  return (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4);
}

function effectiveQuality(quality) {
  return quality === 'low' || (quality === 'auto' && autoLow()) ? 'low' : 'auto';
}

export function createStage(canvas, quality = 'auto') {
  const initialQuality = effectiveQuality(quality);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: initialQuality !== 'low', preserveDrawingBuffer: false, powerPreference: initialQuality === 'low' ? 'low-power' : 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(initialQuality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CONFIG.renderer.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#CDE9F5', 48, 145);
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 16 / 9, CONFIG.camera.near, CONFIG.camera.far);

  const hemi = new THREE.HemisphereLight('#C5E7FF', '#F6C9A5', 1.8);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#FFF1D6', 2.45);
  key.position.set(-10, 18, 12);
  key.castShadow = true;
  const shadowSize = initialQuality === 'low' ? 512 : CONFIG.renderer.shadowMapSize;
  key.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 60 });
  key.shadow.bias = -0.0007;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#A7C9FF', 0.85);
  fill.position.set(12, 7, -10);
  scene.add(fill);
  renderer.shadowMap.enabled = initialQuality !== 'low';
  key.castShadow = initialQuality !== 'low';
  return { renderer, scene, camera, key, quality: initialQuality, requestedQuality: quality === 'low' ? 'low' : 'auto' };
}

export function applyQualityToObject(root, quality) {
  root.traverse((object) => {
    if (object.userData.animalOutline) object.visible = quality !== 'low';
  });
}

export function setQuality(stage, quality) {
  stage.requestedQuality = quality === 'low' ? 'low' : 'auto';
  stage.quality = effectiveQuality(stage.requestedQuality);
  stage.renderer.shadowMap.enabled = stage.quality !== 'low';
  stage.key.castShadow = stage.quality !== 'low';
  const shadowSize = stage.quality === 'low' ? 512 : CONFIG.renderer.shadowMapSize;
  stage.key.shadow.mapSize.set(shadowSize, shadowSize);
  stage.key.shadow.map?.dispose();
  stage.key.shadow.map = null;
  stage.renderer.setPixelRatio(stage.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, CONFIG.renderer.maxDpr));
  applyQualityToObject(stage.scene, stage.quality);
  resize(stage);
}

export function buildEnvironment(scene, arena = CLOUD_RING) {
  const root = new THREE.Group();
  scene.add(root);
  root.add(makeSky(arena));
  const arenaView = arena.id === 'candy-works' ? makeCandyArena(arena) : arena.id === 'frozen-lake' ? makeFrozenArena(arena) : makeCloudArena(arena);
  root.add(arenaView.group);
  scene.fog.color.set(arena.palette.sky2);

  const clouds = [];
  const islands = [];
  if (arena.id === 'cloud-ring') {
    for (let i = 0; i < CONFIG.scene.cloudCount; i++) {
      const cloud = makeCloud(i);
      const angle = i * Math.PI * 2 / CONFIG.scene.cloudCount + 0.3;
      const radius = 23 + noise(i) * 24;
      cloud.position.set(Math.sin(angle) * radius, -2 + noise(i + 20) * 6, Math.cos(angle) * radius);
      const scale = 1.2 + noise(i + 40) * 1.8;
      cloud.scale.setScalar(scale);
      root.add(cloud);
      clouds.push({ group: cloud, baseX: cloud.position.x, baseY: cloud.position.y, phase: noise(i + 60) * Math.PI * 2 });
    }
    for (let i = 0; i < CONFIG.scene.islandCount; i++) {
      const island = makeIsland(i);
      const angle = 3.45 + i * 0.8;
      const radius = 30 + i * 8;
      island.position.set(Math.sin(angle) * radius, i * 2, Math.cos(angle) * radius);
      island.scale.setScalar(1 - i * 0.18);
      root.add(island);
      islands.push({ group: island, baseY: island.position.y, phase: i * 1.7 });
    }
  }

  function update(dt, time, hazardTime = time) {
    for (const cloud of clouds) {
      cloud.group.position.x = cloud.baseX + Math.sin(time * CONFIG.scene.cloudDrift + cloud.phase) * 3;
      cloud.group.position.y = cloud.baseY + Math.sin(time * 0.18 + cloud.phase) * 0.3;
    }
    for (const island of islands) island.group.position.y = island.baseY + Math.sin(time * 0.25 + island.phase) * 0.35;
    for (const flag of arenaView.flags ?? []) {
      flag.mesh.rotation.z = Math.sin(time * 1.8 + flag.phase) * 0.055;
      flag.mesh.position.y = flag.baseY + Math.sin(time * 2.1 + flag.phase) * 0.025;
    }
    for (const balloon of arenaView.balloons ?? []) balloon.group.position.y = balloon.baseY + Math.sin(time * 1.25 + balloon.phase) * CONFIG.scene.balloonFloat;
    arenaView.springs?.forEach((spring, index) => { spring.position.y = 0.39 + Math.sin(time * 2.2 + index) * 0.025; });
    arenaView.update?.(time, hazardTime);
  }
  function setArenaBounds(bounds) {
    arenaView.setBounds?.(bounds);
  }
  function setArenaRadius(radius) {
    if (arena.shape === 'circle') setArenaBounds({ radius });
  }
  function dispose() {
    scene.remove(root);
    disposeObject(root);
  }
  return { root, arena: arenaView, update, setArenaRadius, setArenaBounds, dispose };
}

export function resize(stage) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  stage.renderer.setSize(width, height, false);
  stage.camera.aspect = width / Math.max(1, height);
  stage.camera.fov = stage.camera.aspect < 1 ? CONFIG.camera.portraitFov : CONFIG.camera.fov;
  stage.camera.updateProjectionMatrix();
}

export function applyCamera(stage, view) {
  const horizontal = Math.cos(view.elevation) * view.distance;
  const amplitude = view.shake ?? 0;
  const time = view.time ?? 0;
  stage.camera.position.set(
    view.target.x + Math.sin(view.azimuth) * horizontal + Math.sin(time * CONFIG.camera.shakeFrequency) * amplitude,
    view.target.y + Math.sin(view.elevation) * view.distance + Math.sin(time * CONFIG.camera.shakeFrequency + 1) * amplitude,
    view.target.z + Math.cos(view.azimuth) * horizontal + Math.sin(time * CONFIG.camera.shakeFrequency + 2) * amplitude,
  );
  stage.camera.lookAt(view.target.x, view.target.y, view.target.z);
}
