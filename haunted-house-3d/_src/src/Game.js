import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { House } from './world/House.js';
import { ghostFaceDataURL } from './world/Textures.js';
import { Player } from './player/Player.js';
import { AudioEngine } from './systems/AudioEngine.js';
import { Ghost } from './systems/Ghost.js';
import { ScareDirector } from './systems/ScareDirector.js';
import { HUD } from './ui/HUD.js';

const TOTAL_KEYS = 3;
const BURN_RANGE = 10;       // how far the beam reaches him
const BATTERY_REFILL = 45;

/* i18n: dictionaries live in config/locales.js (kit). Keys = English originals. */
const tr = (s) => (window.I18N && window.I18N.t ? window.I18N.t(s) : s);
const fmt = (s, vars) => tr(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
const sdk = () => window.PipySDK || null;

/** Silent stand-in if WebAudio is unavailable — every call becomes a no-op. */
function silentAudio() {
  return new Proxy({}, { get: (t, k) => (k === 'muted' ? false : () => {}) });
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'title'; // title | playing | caught | escaped
    this.keysFound = 0;
    this.chaseActive = false;
    this.escaping = false;
    this.startTime = 0;
    this.banishes = 0;
    this.fallbackLook = false;   // pointer lock denied → drag-to-look mode
    this.muted = false;
    this._lastWin = null;

    this._setupRenderer();
    this._setupScene();

    this.hud = new HUD();
    try { this.audio = new AudioEngine(); } catch (e) { this.audio = silentAudio(); }
    this.house = new House(this.scene);
    this.player = new Player(this.camera, this.canvas, this.audio);
    this.player.addTo(this.scene);
    this.ghost = new Ghost(this.scene);
    this.director = new ScareDirector(this);

    this._setupComposer();

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 2.6;

    this._bindEvents();

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._tick());
  }

  /* ---------------- setup ---------------- */

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer?.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.085);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 60);
  }

  _setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // subtle bloom: candle flames, key glints, his eyes
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.7, 0.62);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());
  }

  _bindEvents() {
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) this.fallbackLook = false;
      this.player.fallbackLook = this.fallbackLook;
      this.player.enabled = (locked || this.fallbackLook) && this.state === 'playing';
      if (!locked && this.state === 'playing' && !this.fallbackLook) {
        document.getElementById('pause-screen').classList.remove('hidden');
      } else {
        document.getElementById('pause-screen').classList.add('hidden');
      }
    });
    // Sandbox / denied pointer lock → degrade to drag-to-look instead of freezing.
    document.addEventListener('pointerlockerror', () => this._enableFallbackLook());
    document.getElementById('pause-screen').addEventListener('click', () => {
      if (this.fallbackLook) {
        document.getElementById('pause-screen').classList.add('hidden');
        this.player.enabled = this.state === 'playing';
      } else {
        this._requestLock();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && this.state === 'playing') {
        if (this.hud.noteOpen) this.hud.hideNote();
        else this._tryInteract();
      }
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'Escape' && this.fallbackLook && this.state === 'playing') {
        this.player.enabled = false;
        document.getElementById('pause-screen').classList.remove('hidden');
      }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    document.getElementById('retry-btn').addEventListener('click', () => location.reload());
    document.getElementById('again-btn').addEventListener('click', () => location.reload());

    // sound toggle button (reachable whenever the mouse is free)
    const muteBtn = document.getElementById('mute-btn');
    muteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleMute(); });
    this._muteBtn = muteBtn;

    // re-render JS-driven text when the player switches language mid-game
    window.addEventListener('langchange', () => {
      this._syncMuteBtn();
      if (this.state === 'escaped' && this._lastWin) this._renderWinStats();
    });
  }

  /** requestPointerLock that never throws: sync errors and promise rejections both degrade. */
  _requestLock() {
    // Opaque origin = sandboxed iframe without allow-same-origin. Pointer lock is
    // typically blocked there; skip the request so the console stays clean and
    // go straight to drag-to-look.
    if (window.origin === 'null') { this._enableFallbackLook(); return; }
    try {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => this._enableFallbackLook());
    } catch (e) {
      this._enableFallbackLook();
    }
  }

  _enableFallbackLook() {
    if (this.fallbackLook) return;
    this.fallbackLook = true;
    this.player.fallbackLook = true;
    document.getElementById('pause-screen').classList.add('hidden');
    if (this.state === 'playing') {
      this.player.enabled = true;
      this.hud.toast('Mouse lock unavailable — hold and drag to look around.', 4200);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this._syncMuteBtn();
    if (this.state === 'playing') this.hud.toast(this.muted ? 'Sound muted' : 'Sound on', 1600);
  }

  _syncMuteBtn() {
    if (!this._muteBtn) return;
    this._muteBtn.textContent = this.muted ? tr('SOUND OFF') : tr('SOUND ON');
    this._muteBtn.classList.toggle('muted', this.muted);
  }

  /* ---------------- flow ---------------- */

  start() {
    this.state = 'playing';
    this.startTime = performance.now();
    this.audio.resume();
    this.audio.startAmbient();
    this.hud.show();
    this.hud.setObjective('Find the three brass keys');
    this.hud.setKeys(0, TOTAL_KEYS);
    this.hud.setBattery(this.player.battery);
    this._syncMuteBtn();
    const s = sdk(); if (s) s.newRun({ keys: TOTAL_KEYS });
    this._requestLock();
    // an unwelcome welcome
    setTimeout(() => this.audio.doorCreak(), 1200);
    setTimeout(() => this.audio.thump(0.3), 4200);
  }

  _onCaught() {
    if (this.state !== 'playing') return;
    this.state = 'caught';
    this.player.enabled = false;
    document.exitPointerLock();
    const s = sdk(); if (s) s.gameOver({ keysFound: this.keysFound });
    this.audio.scream();
    this.audio.stopHeartbeat();
    this.audio.stopChaseMusic();
    this.audio.setBreathLevel(0);
    this.audio.setSizzle(0);
    this.hud.jumpscare(ghostFaceDataURL());
    this.hud.shake();
    setTimeout(() => {
      this.hud.hideJumpscare();
      this.hud.hide();
      this.hud.setDanger(false);
      document.getElementById('death-screen').classList.remove('hidden');
    }, 1500);
  }

  _onEscaped() {
    this.state = 'escaped';
    this.player.enabled = false;
    this.audio.stopHeartbeat();
    this.audio.stopChaseMusic();
    this.audio.setBreathLevel(0);
    this.audio.setSizzle(0);
    this.audio.setDroneIntensity(0);
    document.exitPointerLock();
    const seconds = Math.round((performance.now() - this.startTime) / 1000);
    this._lastWin = { seconds, banishes: this.banishes };
    const s = sdk(); if (s) s.levelCleared({ seconds, banishes: this.banishes });
    this._renderWinStats();
    this.hud.hide();
    this.hud.setDanger(false);
    document.getElementById('win-screen').classList.remove('hidden');
  }

  _renderWinStats() {
    const { seconds, banishes } = this._lastWin;
    const m = Math.floor(seconds / 60), s = seconds % 60;
    const lines = [tr('You found all three keys and walked out of the dark.')];
    if (banishes > 0) lines.push(fmt('You drove him back {n} time(s) with nothing but a flashlight.', { n: banishes }));
    lines.push(fmt('Time inside the house: {t}', { t: `${m}:${String(s).padStart(2, '0')}` }));
    document.getElementById('win-stats').innerHTML = lines.join('<br/>');
  }

  /* ---------------- interaction ---------------- */

  _tryInteract() {
    const hit = this._lookTarget();
    if (!hit) return;
    const info = hit.userData.interact;
    switch (info.type) {
      case 'key': this._takeKey(info); break;
      case 'battery':
        this.house.removeBattery(info.group);
        this.player.addBattery(BATTERY_REFILL);
        this.audio.batteryPickup();
        this.hud.toast('Fresh batteries. The light is your weapon.');
        break;
      case 'note':
        this.audio.click();
        this.hud.showNote(info.text);
        break;
      case 'door':
        this.audio.doorCreak();
        info.door.toggle();
        break;
      case 'frontdoor':
        if (this.keysFound >= TOTAL_KEYS) {
          this.audio.unlock();
          info.door.setOpen(true, 1.4);
          this.escaping = true;
          this.hud.setObjective('RUN');
        } else {
          this.audio.lockedRattle();
          this.hud.toast(fmt('Locked tight. Three keyholes. You have {n} of 3 keys.', { n: this.keysFound }));
        }
        break;
    }
  }

  _takeKey(info) {
    this.house.removeKey(info.group);
    this.keysFound++;
    this.audio.pickup();
    this.hud.setKeys(this.keysFound, TOTAL_KEYS);
    this.hud.flash('#211a08', 0.3, 120);

    if (info.id === 'study') this.director.studyKeyScare();

    if (this.keysFound >= TOTAL_KEYS) {
      this._beginFinale();
    } else if (this.keysFound === 2) {
      this.hud.toast('One key left. You can feel him watching now.', 3000);
      this.audio.setDroneIntensity(0.45);
      this.audio.growl();
    } else {
      this.hud.toast(fmt('A brass key. {n} remain.', { n: TOTAL_KEYS - this.keysFound }));
      this.audio.setDroneIntensity(0.2);
    }
  }

  _beginFinale() {
    this.hud.toast('The last key. Something just woke up.', 3200);
    this.hud.setObjective('GET TO THE FRONT DOOR');
    this.ghost.vanish(); // clear any stalker — he is gathering himself
    // a dead beat of silence... then everything goes wrong
    setTimeout(() => {
      this.house.setBlackout(true);
      this.player.flashlightFlicker(1.6);
      this.audio.staticBurst(0.35);
    }, 1400);
    setTimeout(() => {
      this.audio.scream();
      this.hud.flash('#300000', 0.65, 260);
      this.hud.shake();
      this.hud.setDanger(true);
      this.audio.setDroneIntensity(1);
      this.audio.startHeartbeat(96);
      this.audio.startChaseMusic();
      this.chaseActive = true;
      // he rises in the hallway, between you and the door if you're north
      const p = this.player.position;
      const spawn = p.z < 0.5 ? new THREE.Vector3(0, 0, 1.0) : new THREE.Vector3(0, 0, -6.5);
      this.ghost.startChase(spawn);
    }, 2600);
  }

  _lookTarget() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(this.house.interactables, false);
    return hits.length ? hits[0].object : null;
  }

  /* ---------------- fight back: the beam burns him ---------------- */

  _updateBurn(dt) {
    let burning = false;
    if (this.ghost.engaged && this.player.beamActive) {
      const head = this.ghost.group.position.clone();
      head.y = 1.9;
      const toGhost = head.sub(this.camera.position);
      const dist = toGhost.length();
      if (dist < BURN_RANGE) {
        const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
        const angle = forward.angleTo(toGhost.normalize());
        // generous cone up close, tight at range
        if (angle < 0.22 + 0.9 / Math.max(dist, 1)) burning = true;
      }
    }

    this.player.burning = burning;
    if (burning) {
      const result = this.ghost.applyBurn(dt);
      this.audio.setSizzle(0.5 + this.ghost.burnMeter * 0.5);
      this.hud.setBurn(this.ghost.burnMeter);
      if (result === 'banished') {
        this.banishes++;
        this.audio.banishShriek();
        this.hud.flash('#cfd8ee', 0.5, 300);
        this.hud.shake();
        this.hud.setBurn(0);
        this.audio.setSizzle(0);
        this.audio.setBreathLevel(0);
        if (this.chaseActive) {
          this.hud.toast('He came apart in the beam — but he will reform. RUN.', 2600);
        } else {
          this.hud.toast('Banished. The dark went quiet again.', 2600);
          this.hud.setDanger(false);
        }
      }
    } else {
      this.ghost.stopBurn();
      this.audio.setSizzle(0);
      this.hud.setBurn(this.ghost.engaged ? this.ghost.burnMeter : 0);
    }
  }

  /* ---------------- main loop ---------------- */

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    this.house.update(dt, t);

    if (this.state === 'playing') {
      this.player.update(dt, this.house.getColliders());
      this.director.update(dt, this.player.position);

      const caught = this.ghost.update(dt, this.player.position, t);
      if (caught) this._onCaught();

      this._updateBurn(dt);
      this.hud.setBattery(this.player.battery);

      // his breathing closes in with him
      if (this.ghost.engaged) {
        const d = this.ghost.distanceTo(this.player.position);
        this.audio.setBreathLevel(THREE.MathUtils.clamp(1.3 - d / 9, 0, 1));
        this.hud.setDanger(true);
      } else {
        this.audio.setBreathLevel(0);
        if (!this.chaseActive) this.hud.setDanger(false);
      }

      // heartbeat tempo scales with how close he is
      if (this.chaseActive && this.ghost.mode !== 'hidden') {
        const d = this.ghost.distanceTo(this.player.position);
        this.audio.startHeartbeat(Math.round(THREE.MathUtils.clamp(160 - d * 9, 88, 160) / 8) * 8);
      }

      // interact prompt
      if (!this.hud.noteOpen) {
        const target = this._lookTarget();
        if (target) {
          const type = target.userData.interact.type;
          this.hud.setPrompt(
            type === 'key' ? 'Take the key'
            : type === 'battery' ? 'Take the batteries'
            : type === 'note' ? 'Read'
            : type === 'frontdoor' ? (this.keysFound >= TOTAL_KEYS ? 'Unlock the front door' : 'Front door')
            : 'Door');
        } else this.hud.setPrompt(null);
      } else this.hud.setPrompt(null);

      // escape: step through the open front door
      if (this.escaping && this.player.position.z > 7.5 &&
          this.player.position.x > -1.1 && this.player.position.x < 1.1) {
        this._onEscaped();
      }
    }

    this.composer.render();
  }
}
