// 角色贴图加载：assets/character_v2/*.webp（AI 拆件，透明底，已裁到内容边界）
import * as THREE from 'three';

const FILES = {
  head: 'head', torso: 'torso',
  armUpper: 'arm_upper', armFore: 'arm_fore',
  thigh: 'thigh', shin: 'shin', boot: 'boot',
  headBig: 'head_big', torsoBig: 'torso_big',
};

export async function loadCharacterArt(base = './assets/character_v4/') {
  const loader = new THREE.TextureLoader();
  const out = {};
  await Promise.all(Object.entries(FILES).map(async ([n, file]) => {
    const tex = await loader.loadAsync(`${base}${file}.webp`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    out[n] = { texture: tex, aspect: tex.image.width / tex.image.height };
  }));
  return out;
}
