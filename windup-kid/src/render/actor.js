import * as THREE from 'three';

/** 灰盒角色：木偶比例（小身大头 + 发条钥匙），只为验证比例与朝向 */
export function createPlayerMesh() {
  const group = new THREE.Group();

  const wood = new THREE.MeshLambertMaterial({ color: 0xb5814f });
  const vest = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2118 });
  const brass = new THREE.MeshLambertMaterial({ color: 0xd4a017 });

  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

  const legs = box(0.46, 0.3, 0.4, wood);
  legs.position.y = -0.33;
  const body = box(0.52, 0.4, 0.44, vest);
  body.position.y = -0.05;
  const head = box(0.46, 0.4, 0.42, wood);
  head.position.y = 0.28;
  const nose = box(0.1, 0.09, 0.09, wood);
  nose.position.set(0.25, 0.27, 0);
  const eyeL = box(0.07, 0.09, 0.02, dark);
  eyeL.position.set(0.16, 0.34, 0.21);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.21;
  const key = box(0.09, 0.09, 0.09, brass);
  key.position.set(-0.28, 0.0, 0);

  for (const m of [legs, body, head, nose, eyeL, eyeR, key]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  return {
    group,
    update(x, y, facing, hScale = 1) {
      group.position.set(x, y, 0);
      group.scale.set(facing >= 0 ? 1 : -1, hScale, 1);
    },
  };
}

export function createEnemyMesh(kind, tex = null) {
  const group = new THREE.Group();

  if (tex) {
    const aspect = tex.image.width / tex.image.height;
    const h = kind === 'shell' ? 1.1 : 1.0;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), mat);
    sprite.castShadow = true;
    group.add(sprite);
    return group;
  }

  const shellLike = kind === 'shell';
  const bodyMat = new THREE.MeshLambertMaterial({ color: shellLike ? 0xa8814a : 0x7a5230 });
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0xfff3dc });
  const pupilMat = new THREE.MeshLambertMaterial({ color: 0x171009 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, shellLike ? 0.75 : 0.58, 0.58), bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 眼睛做大一点，灰盒阶段也要能一眼看出朝向
  for (const dz of [0.17, -0.17]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.14), eyeMat);
    eye.position.set(0.32, 0.12, dz);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.07), pupilMat);
    pupil.position.set(0.36, 0.11, dz);
    group.add(pupil);
  }
  return group;
}


export function createFireballMesh() {
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color: 0xffc154 }),
  );
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.38, 0),
    new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.5 }),
  );
  group.add(core, halo);
  return group;
}

export function createItemMesh(kind) {
  const group = new THREE.Group();

  if (kind === 'flower') {
    const stem = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.3, 0.16),
      new THREE.MeshLambertMaterial({ color: 0x6f9a5a }),
    );
    stem.position.y = -0.2;
    const bulb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.26, 0),
      new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
    );
    bulb.position.y = 0.06;
    const glow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.36, 0),
      new THREE.MeshBasicMaterial({ color: 0xffcf6a, transparent: true, opacity: 0.35 }),
    );
    glow.position.y = 0.06;
    group.add(stem, bulb, glow);
    return group;
  }

  if (kind === 'mushroom') {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.34, 0.62),
      new THREE.MeshLambertMaterial({ color: 0xc0392b }),
    );
    cap.position.y = 0.12;
    const stem = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.3, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffe9c4 }),
    );
    stem.position.y = -0.16;
    for (const part of [cap, stem]) {
      part.castShadow = true;
      group.add(part);
    }
  }
  return group;
}
