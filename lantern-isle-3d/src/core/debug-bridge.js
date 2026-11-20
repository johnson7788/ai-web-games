// runtime/debug-bridge.js — Agent 的观察面（Game MCP 的本地等价契约）。脚手架复制到 src/core/debug-bridge.js。
// 装上后 Agent 才能「看见」正在运行的游戏：场景结构、物体 transform、fps、DrawCall、错误、音频、可调用动作。
// 契约（tools=probe.mjs 的子命令）：meta/scene/objects/stats/audio/state/call/layout
// 这个文件只做「读内部状态 + 白名单动作」，不参与玩法判定。
export function installBridge(ctx) {
  const { renderer, scene, camera, sim, audio } = ctx;
  const registry = ctx.registry || new Map(); // name -> THREE.Object3D（世界物体登记，probe objects 靠它）
  const actions = ctx.actions || {};
  let frames = [], last = performance.now(), acc = 0, count = 0, fps = 0, avgFrameMs = 16.7;
  const sample = () => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    if (dt > 0 && dt < 500) { frames.push(dt); if (frames.length > 120) frames.shift(); }
    acc += dt; count++;
    if (acc >= 500) { fps = Math.round(1000 / (acc / count)); avgFrameMs = +(acc / count).toFixed(2); acc = 0; count = 0; }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);

  const tri = (o) => {
    let t = 0;
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      const g = m.geometry;
      t += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      if (m.isInstancedMesh) t *= Math.max(1, m.count);
    });
    return Math.round(t);
  };
  const entry = (name, o, deep = true) => ({
    name,
    kind: o.userData?.kind || (o.isInstancedMesh ? 'instanced' : o.isGroup ? 'group' : o.type.toLowerCase()),
    pos: [+o.position.x.toFixed(2), +o.position.y.toFixed(2), +o.position.z.toFixed(2)],
    rotY: +o.rotation.y.toFixed(2),
    scale: [+o.scale.x.toFixed(2), +o.scale.y.toFixed(2), +o.scale.z.toFixed(2)],
    visible: o.visible,
    tri: deep ? tri(o) : 0,
    tags: o.userData?.tags || [],
    state: o.userData?.state || null,
  });

  const api = {
    ready: true,
    meta: () => ({ ...(ctx.meta || {}), style: ctx.bible?.style?.name || null, artBibleVersion: ctx.bible?.version || null }),
    scene: () => {
      let meshCount = 0, lightCount = 0, mats = new Set();
      scene.traverse((o) => {
        if (o.isMesh || o.isInstancedMesh) meshCount++;
        if (o.isLight) lightCount++;
        if (o.material) mats.add(o.material.uuid);
      });
      const lights = [];
      scene.traverse((o) => { if (o.isLight) lights.push({ type: o.type, intensity: +(o.intensity ?? 0).toFixed(2), color: '#' + (o.color ? o.color.getHexString() : 'ffffff'), pos: [+o.position.x.toFixed(1), +o.position.y.toFixed(1), +o.position.z.toFixed(1)] }); });
      return {
        phase: ctx.phase ? ctx.phase() : (sim && sim.state ? sim.state.phase : null),
        camera: { pos: [camera.position.x, camera.position.y, camera.position.z].map((v) => +v.toFixed(2)), fov: camera.fov, yaw: +(ctx.orbit?.yaw ?? 0).toFixed(2), pitch: +(ctx.orbit?.pitch ?? 0).toFixed(2) },
        fog: scene.fog ? { color: '#' + scene.fog.color.getHexString(), near: scene.fog.near, far: scene.fog.far } : null,
        background: scene.background && scene.background.isColor ? '#' + scene.background.getHexString() : null,
        timeOfDay: ctx.timeOfDay ? ctx.timeOfDay() : null,
        lights, meshCount, lightCount, materialCount: mats.size,
        trianglesDrawnMax: renderer ? renderer.info.render.triangles : null,
        zones: ctx.zones ? ctx.zones() : [],
        registered: registry.size,
        errors: (ctx.errors && ctx.errors()) || null,
      };
    },
    objects: (filter = {}) => {
      const out = [];
      const name = String(filter.name || '');
      registry.forEach((o, k) => {
        if (name && !k.includes(name) && !((o.userData?.tags || []).join(' ').includes(name))) return;
        if (out.length < 400) out.push(entry(k, o, filter.deep === true));
      });
      return { objects: out, total: registry.size };
    },
    stats: () => {
      const info = renderer ? renderer.info : null;
      return {
        fps, avgFrameMs,
        drawCalls: info ? info.render.calls : null,
        triangles: info ? info.render.triangles : null,
        geometries: info ? info.memory.geometries : null,
        textures: info ? info.memory.textures : null,
        programs: info && info.programs ? info.programs.length : null,
        registered: registry.size,
        simPhase: sim && sim.state ? sim.state.phase : null,
      };
    },
    audio: () => (audio && audio.getState ? audio.getState() : { ctxState: 'none', masterGain: 0, note: '游戏没实现 audio.getState()，音频门禁必须 FAIL' }),
    state: () => (ctx.simState ? ctx.simState() : (sim && sim.snapshot ? sim.snapshot() : { note: 'sim 没有 snapshot()' })),
    layout: () => (ctx.layout ? ctx.layout() : {}),
    call: ({ fn, args } = {}) => {
      const f = actions[fn];
      if (!f) return { ok: false, error: `未注册动作 ${fn}`, available: Object.keys(actions) };
      try { const r = f(args || {}); return { ok: true, fn, result: r === undefined ? null : r }; } catch (e) { return { ok: false, fn, error: String(e && e.message || e) }; }
    },
    register: (name, obj, tags = []) => { if (obj) { obj.userData = obj.userData || {}; obj.userData.tags = tags; obj.name = name; registry.set(name, obj); } return registry.size; },
    unregister: (name) => registry.delete(name),
    _registry: registry,
  };
  window.__game3d = api;
  return api;
}
