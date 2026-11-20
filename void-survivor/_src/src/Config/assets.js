/**
 * Asset manifest — VOID SURVIVOR is fully procedural: every sound is
 * synthesized at boot (Audio/Synth.js) and registered into the template's
 * ResourceLoader. No network requests, sandbox-proof.
 */
const ASSETS = [
  { id: 'shoot', type: 'proceduralAudio' },
  { id: 'hit', type: 'proceduralAudio' },
  { id: 'kill', type: 'proceduralAudio' },
  { id: 'pickup', type: 'proceduralAudio' },
  { id: 'heal', type: 'proceduralAudio' },
  { id: 'dash', type: 'proceduralAudio' },
  { id: 'hurt', type: 'proceduralAudio' },
  { id: 'wave', type: 'proceduralAudio' },
  { id: 'upgrade', type: 'proceduralAudio' },
  { id: 'gameover', type: 'proceduralAudio' },
  { id: 'click', type: 'proceduralAudio' },
  { id: 'spawn', type: 'proceduralAudio' },
  { id: 'bgm', type: 'proceduralAudio' },
];

export default ASSETS;