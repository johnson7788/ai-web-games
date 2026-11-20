import * as THREE from 'three';

/**
 * UIManager — all DOM overlays & HUD. Dynamic strings go through I18N.t so
 * the kit's language toggle re-renders everything; static labels carry
 * data-i18n and are handled by the kit itself.
 */
export default class UIManager {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('vs-hud'),
      hpFill: document.getElementById('vs-hp-fill'),
      hpNum: document.getElementById('vs-hp-num'),
      dashFill: document.getElementById('vs-dash-fill'),
      waveNum: document.getElementById('vs-wave-num'),
      enemiesLeft: document.getElementById('vs-enemies-left'),
      score: document.getElementById('vs-score'),
      kills: document.getElementById('vs-kills'),
      best: document.getElementById('vs-best'),
      banner: document.getElementById('vs-banner'),
      popups: document.getElementById('vs-popups'),
      flash: document.getElementById('vs-flash'),
      title: document.getElementById('vs-title'),
      titleBest: document.getElementById('vs-title-best'),
      start: document.getElementById('vs-start'),
      upgrade: document.getElementById('vs-upgrade'),
      upgradeTitle: document.getElementById('vs-upgrade-title'),
      cards: document.getElementById('vs-upgrade-cards'),
      gameover: document.getElementById('vs-gameover'),
      goWaves: document.getElementById('vs-go-waves'),
      goKills: document.getElementById('vs-go-kills'),
      goScore: document.getElementById('vs-go-score'),
      goBest: document.getElementById('vs-go-best'),
      newBest: document.getElementById('vs-newbest'),
      restart: document.getElementById('vs-restart'),
      touch: document.getElementById('vs-touch'),
    };
    this._cache = {};
    this._upgradeCb = null;
    this._proj = new THREE.Vector3();

    this.el.start.addEventListener('click', () => this._startGame());
    this.el.restart.addEventListener('click', () => this._restart());

    window.addEventListener('keydown', (e) => {
      const state = this.game.world?.director?.state;
      if (state === 'upgrade' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        this.pickUpgrade(Number(e.code.slice(-1)) - 1);
      }
    });

    window.addEventListener('langchange', () => this._refreshLang());

    this.el.titleBest.textContent = String(this.game.world?.director?.best ?? 0);
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.el.touch.classList.remove('hidden');
    }
  }

  t(s) {
    return window.I18N ? window.I18N.t(s) : s;
  }

  _startGame() {
    const game = this.game;
    // user gesture: unlock audio + start the synthesized BGM loop
    if (game.audioManager.audioContext?.state === 'suspended') {
      game.audioManager.audioContext.resume().catch(() => {});
    }
    game.audioManager.startBGM();
    game.audioManager.play('click', 'sfx', { volume: 0.6 });
    game.world.director.startRun();
    try { if (window.PipySDK) window.PipySDK.newRun({ mode: 'waves' }); } catch (e) { /* noop */ }
  }

  _restart() {
    this.game.audioManager.play('click', 'sfx', { volume: 0.6 });
    this.game.world.director.startRun();
  }

  /* ---------------- screens ---------------- */

  hideTitle() { this.el.title.classList.add('hidden'); }
  showHUD() { this.el.hud.classList.remove('hidden'); }

  showUpgrade(choices, wave, bonus) {
    this.el.upgradeTitle.textContent = `${this.t('WAVE')} ${wave} ${this.t('CLEARED')}`;
    this.el.cards.innerHTML = '';
    choices.forEach((u, i) => {
      const card = document.createElement('button');
      card.className = 'vs-card';
      card.innerHTML =
        `<span class="vs-card-key">[${i + 1}]</span>` +
        `<span class="vs-card-icon">${u.icon}</span>` +
        `<span class="vs-card-name" data-i18n="${u.name}">${u.name}</span>` +
        `<span class="vs-card-desc" data-i18n="${u.desc}">${u.desc}</span>`;
      card.addEventListener('click', () => this.pickUpgrade(i));
      this.el.cards.appendChild(card);
    });
    this.el.upgrade.classList.remove('hidden');
    if (window.I18N) window.I18N.apply();
  }

  pickUpgrade(i) {
    if (this.game.world.director.state !== 'upgrade') return;
    this.game.world.director.chooseUpgrade(i);
  }

  hideUpgrade() { this.el.upgrade.classList.add('hidden'); }

  showGameOver(stats) {
    this.el.goWaves.textContent = String(stats.waves);
    this.el.goKills.textContent = String(stats.kills);
    this.el.goScore.textContent = String(stats.score);
    this.el.goBest.textContent = String(stats.best);
    this.el.newBest.classList.toggle('hidden', !stats.isNewBest);
    this.el.gameover.classList.remove('hidden');
    this.el.titleBest.textContent = String(stats.best);
  }

  hideGameOver() { this.el.gameover.classList.add('hidden'); }

  /* ---------------- in-game feedback ---------------- */

  banner(main, sub) {
    const b = this.el.banner;
    b.classList.add('hidden');
    b.innerHTML = '';
    b.append(main);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      b.appendChild(s);
    }
    // restart CSS animation
    void b.offsetWidth;
    b.classList.remove('hidden');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => b.classList.add('hidden'), 2300);
  }

  popup(worldPos, text, color) {
    const camera = this.game.camera.cameraInstance;
    this._proj.copy(worldPos).project(camera);
    if (this._proj.z > 1) return;
    const x = (this._proj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._proj.y * 0.5 + 0.5) * window.innerHeight;
    const div = document.createElement('div');
    div.className = 'vs-popup';
    div.textContent = text;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.style.color = color;
    this.el.popups.appendChild(div);
    setTimeout(() => div.remove(), 900);
  }

  flash(kind) {
    const f = this.el.flash;
    f.classList.remove('hurt', 'heal');
    void f.offsetWidth;
    f.classList.add(kind);
  }

  updateHUD(s) {
    const c = this._cache;
    const hp = Math.max(0, Math.round(s.hp));
    if (c.hp !== hp || c.maxHp !== s.maxHp) {
      c.hp = hp;
      c.maxHp = s.maxHp;
      this.el.hpFill.style.width = `${(hp / s.maxHp) * 100}%`;
      this.el.hpFill.classList.toggle('low', hp / s.maxHp < 0.3);
      this.el.hpNum.textContent = String(hp);
    }
    if (c.wave !== s.wave) {
      c.wave = s.wave;
      this.el.waveNum.textContent = String(s.wave);
    }
    if (c.kills !== s.kills) {
      c.kills = s.kills;
      this.el.kills.textContent = String(s.kills);
    }
    if (c.score !== s.score) {
      c.score = s.score;
      this.el.score.textContent = String(s.score);
    }
    if (c.best !== s.best) {
      c.best = s.best;
      this.el.best.textContent = String(s.best);
    }
    const dash = Math.round(s.dashFrac * 100);
    if (c.dash !== dash) {
      c.dash = dash;
      this.el.dashFill.style.width = `${dash}%`;
    }
    if (c.left !== s.enemiesLeft || c.state !== s.state) {
      c.left = s.enemiesLeft;
      c.state = s.state;
      this.el.enemiesLeft.textContent =
        s.state === 'playing' ? `${this.t('ENEMIES')}: ${s.enemiesLeft}` : '';
    }
  }

  _refreshLang() {
    // The kit translates en→zh text nodes but cannot reverse them; reset
    // every data-i18n element to its English source key, then re-apply.
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (el.children.length === 0) el.textContent = k;
    });
    if (window.I18N) window.I18N.apply();

    // re-render dynamic strings on language switch
    this._cache = {};
    const d = this.game.world.director;
    if (d.state === 'upgrade') {
      this.showUpgrade(d.upgradeChoices, d.wave, 0);
    }
    const left = this.el.enemiesLeft.textContent.split(':').pop().trim();
    this.el.enemiesLeft.textContent =
      d.state === 'playing' ? `${this.t('ENEMIES')}: ${left}` : '';
  }
}