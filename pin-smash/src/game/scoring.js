// src/game/scoring.js — Standard ten-pin bowling scoring (pure, no deps).
// Rolls are a flat list of pin counts. Frames 1-9: strike = 10 + next 2, spare = 10 + next 1.
// Frame 10: up to 3 rolls (earn a 3rd via strike or spare). Max game = 300.

export function newFrames() {
  return Array.from({ length: 10 }, () => []);
}

// Is the given frame finished, based on its rolls so far?
export function frameComplete(f, rolls) {
  if (f < 9) return rolls[0] === 10 || rolls.length >= 2;
  // 10th frame
  if (rolls.length >= 3) return true;
  if (rolls.length === 2) return !(rolls[0] === 10 || rolls[0] + rolls[1] === 10);
  return false;
}

// Flatten frames into a roll list.
export function flatRolls(frames) {
  const out = [];
  for (const fr of frames) for (const r of fr) out.push(r);
  return out;
}

// Compute per-frame scores + cumulative + total from a flat roll list.
// Returns { frames:[{rolls,marks,score,cumulative,pending,strike,spare}], total, resolvedTotal, complete }
export function scoreGame(frames) {
  const rolls = flatRolls(frames);
  const result = [];
  let i = 0;
  let cumulative = 0;
  let resolvedTotal = 0;

  for (let f = 0; f < 10; f++) {
    const fr = frames[f] || [];
    let score = 0;
    let pending = false;
    let strike = false;
    let spare = false;
    let used = 0;

    if (f === 9) {
      score = fr.reduce((a, b) => a + b, 0);
      strike = fr[0] === 10;
      spare = !strike && fr.length >= 2 && fr[0] + fr[1] === 10;
      used = fr.length;
      pending = !frameComplete(9, fr);
    } else if (rolls[i] === 10) {
      strike = true;
      const b1 = rolls[i + 1];
      const b2 = rolls[i + 2];
      score = 10 + (b1 || 0) + (b2 || 0);
      pending = b1 === undefined || b2 === undefined;
      used = 1;
    } else if (rolls[i + 1] !== undefined && (rolls[i] || 0) + rolls[i + 1] === 10) {
      spare = true;
      const b1 = rolls[i + 2];
      score = 10 + (b1 || 0);
      pending = b1 === undefined;
      used = 2;
    } else {
      score = (rolls[i] || 0) + (rolls[i + 1] || 0);
      used = 2;
      pending = rolls[i] === undefined; // frame not started
    }

    if (!pending && fr.length > 0) {
      cumulative += score;
      resolvedTotal += score;
      result.push({ rolls: fr.slice(), marks: marksFor(fr, f), score, cumulative, pending: false, strike, spare });
    } else {
      result.push({ rolls: fr.slice(), marks: marksFor(fr, f), score: null, cumulative: null, pending: true, strike, spare });
    }
    i += used;
  }

  const complete = frames.every((fr, f) => frameComplete(f, fr)) && frames[9].length > 0;
  return { frames: result, total: cumulative, resolvedTotal, complete };
}

// Display marks for a frame's rolls: X (strike), / (spare), - (gutter/0), digit.
export function marksFor(fr, f) {
  const m = [];
  if (f < 9) {
    if (fr[0] === 10) { m.push('X'); }
    else {
      m.push(fr[0] === undefined ? '' : fr[0] === 0 ? '–' : String(fr[0]));
      if (fr[1] !== undefined) m.push(fr[0] + fr[1] === 10 ? '/' : fr[1] === 0 ? '–' : String(fr[1]));
      else m.push('');
    }
  } else {
    // 10th frame: up to 3 boxes. A strike or spare resets the rack (fresh).
    let prev = 0;
    let fresh = true;
    for (let k = 0; k < 3; k++) {
      const v = fr[k];
      if (v === undefined) { m.push(''); continue; }
      if (fresh) {
        if (v === 10) { m.push('X'); fresh = true; prev = 0; }
        else { m.push(v === 0 ? '–' : String(v)); fresh = false; prev = v; }
      } else if (prev + v === 10) { m.push('/'); fresh = true; prev = 0; }
      else { m.push(v === 0 ? '–' : String(v)); fresh = false; prev = v; }
    }
  }
  return m;
}

export function ratingFor(total) {
  if (total >= 250) return { key: 'legend', stars: 5 };
  if (total >= 200) return { key: 'pro', stars: 5 };
  if (total >= 150) return { key: 'great', stars: 4 };
  if (total >= 100) return { key: 'good', stars: 3 };
  if (total >= 50) return { key: 'rookie', stars: 2 };
  return { key: 'beginner', stars: 1 };
}