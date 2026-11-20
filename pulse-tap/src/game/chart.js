// PULSE TAP · 谱面生成（纯逻辑，seeded 可复现，与内置节拍锁相）
// 产出：notes 数组，按 time 升序；每项 { id, time, track, dur, kind, toTrack, slideTime }。
// kind: 'tap' | 'hold' | 'slide' | 'fake'（假 note 灰色不可点，点了扣血断连）。
// 密度 = 每秒 note 数；同步到 8 分音符网格（step = beat/2），syncopate 段落点偏移半格。

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

// 取 t 时刻所属段的参数（未给 segments 则用关卡级参数）。
export function segmentAt(level, t) {
  let seg = null;
  for (const s of level.segments || []) {
    if (t >= s.t) seg = s;
  }
  return {
    density: seg && seg.density != null ? seg.density : (level.density || 1.0),
    syncopate: !!(seg && seg.syncopate),
    holdP: level.holdP || 0,
    slideP: level.slideP || 0,
    fakeP: level.fakeP || 0,
    chordP: level.chordP || 0,
  };
}

// 轨道分配策略：single=单轨轮换 / alt2=两轨交替 / alt4=四轨轮换 / chord=自由多轨 / free=随机。
function pickTracks(pattern, lanes, cursor, count, rng) {
  const n = lanes.length;
  const out = [];
  if (pattern === 'single' || pattern === 'alt2' || pattern === 'alt4') {
    let span = 1;
    if (pattern === 'alt2') span = Math.min(2, n);
    else if (pattern === 'alt4') span = Math.min(4, n);
    for (let i = 0; i < count; i += 1) {
      const idx = (cursor + i) % span;
      if (idx < n) out.push(lanes[idx]);
    }
    return out;
  }
  // free / chord：随机选不重复的轨道
  const pool = [...lanes];
  for (let i = 0; i < count && pool.length; i += 1) {
    const j = Math.floor(rng() * pool.length);
    out.push(pool.splice(j, 1)[0]);
  }
  return out;
}

function adjacentTrack(track, lanes, rng) {
  const i = lanes.indexOf(track);
  const left = lanes[i - 1];
  const right = lanes[i + 1];
  const candidates = [left, right].filter((v) => v != null);
  if (!candidates.length) return track;
  return candidates[Math.floor(rng() * candidates.length)];
}

function rollKind(seg, rng) {
  const r = rng();
  if (seg.fakeP > 0 && r < seg.fakeP) return 'fake';
  if (seg.holdP > 0 && r < seg.fakeP + seg.holdP) return 'hold';
  if (seg.slideP > 0 && r < seg.fakeP + seg.holdP + seg.slideP) return 'slide';
  return 'tap';
}

export function generateChart(level, seed) {
  const rng = mulberry32(((seed || 1) * 2654435761) >>> 0);
  const beat = 60 / level.bpm;
  const step = beat / 2;
  const lanes = level.lanes || [0, 1, 2, 3];
  const pattern = level.pattern || 'free';
  const notes = [];
  const lastTrack = [-Infinity, -Infinity, -Infinity, -Infinity];
  let cursor = 0;
  let t = 0.0;
  let guard = 0;

  while (t < level.durationSec - step && guard++ < 20000) {
    const seg = segmentAt(level, t);
    const p = clamp(seg.density * step, 0, 0.92);
    const place = rng() < p;
    if (place) {
      let noteT = t;
      if (seg.syncopate && rng() < 0.5) noteT = t + step / 2;

      let count = 1;
      if (seg.chordP > 0 && rng() < seg.chordP) count = 2 + (rng() < 0.45 ? 1 : 0);
      count = Math.min(count, lanes.length);

      const tracks = pickTracks(pattern, lanes, cursor, count, rng);
      let placed = 0;
      for (const tr of tracks) {
        if (noteT - lastTrack[tr] < beat * 0.9) continue; // 同轨最小间隔，避免判定窗重叠
        const kind = rollKind(seg, rng);
        const note = { time: noteT, track: tr, dur: 0, kind };
        if (kind === 'hold') {
          note.dur = Math.max(beat, (1 + Math.floor(rng() * 2)) * beat); // 1–2 拍
        }
        if (kind === 'slide') {
          note.toTrack = adjacentTrack(tr, lanes, rng);
          note.slideTime = noteT + Math.max(step, beat * 0.5);
        }
        notes.push(note);
        lastTrack[tr] = noteT + (kind === 'hold' ? note.dur : 0);
        cursor = (tr + 1) % lanes.length;
        placed += 1;

        // 滑键 = 首 note + 相邻轨的接续 note（slideEnd），都按 tap 判定；连上触发 slideChain。
        if (kind === 'slide' && note.slideTime < level.durationSec - step) {
          if (note.slideTime - lastTrack[note.toTrack] >= beat * 0.9) {
            notes.push({ time: note.slideTime, track: note.toTrack, dur: 0, kind: 'slideEnd', fromTrack: tr });
            lastTrack[note.toTrack] = note.slideTime;
          }
        }
      }
    }
    t += step;
  }

  notes.sort((a, b) => a.time - b.time || a.track - b.track);
  notes.forEach((n, i) => { n.id = i; });

  return { notes, duration: level.durationSec, bpm: level.bpm, beat, step };
}
