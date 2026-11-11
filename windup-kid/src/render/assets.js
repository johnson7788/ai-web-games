// 场景资源加载：敌人精灵、木箱、远景。加载失败返回 null，渲染层自动回退到色块。
import * as THREE from 'three';

function loadTex(loader, url) {
  return loader.loadAsync(url).then((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}

export async function loadEnvArt(base = './assets/') {
  const loader = new THREE.TextureLoader();
  const [beetle, shell, crate, crateTop, backdrop, ground, dirt, stone, gear, fringe, goal, checkpoint, spring, tuft, flower, decoStone] = await Promise.all([
    loadTex(loader, `${base}enemies/beetle.webp`),
    loadTex(loader, `${base}enemies/shell.webp`),
    loadTex(loader, `${base}tiles/crate_v2.webp`),
    loadTex(loader, `${base}tiles/crate_top.webp`),
    loadTex(loader, `${base}backdrop_v2.jpg`),
    loadTex(loader, `${base}tiles/ground_atlas.webp`),
    loadTex(loader, `${base}tiles/dirt.webp`),
    loadTex(loader, `${base}tiles/stone.webp`),
    loadTex(loader, `${base}props/gear.webp`),
    loadTex(loader, `${base}props/grass_fringe.webp`),
    loadTex(loader, `${base}props/goal.webp`),
    loadTex(loader, `${base}props/checkpoint.webp`),
    loadTex(loader, `${base}props/spring.webp`),
    loadTex(loader, `${base}props/decal_tuft.webp`),
    loadTex(loader, `${base}props/decal_flower.webp`),
    loadTex(loader, `${base}props/decal_stone.webp`),
  ]);
  return { beetle, shell, crate, crateTop, backdrop, ground, dirt, stone, gear, fringe, goal, checkpoint, spring, tuft, flower, decoStone };
}
