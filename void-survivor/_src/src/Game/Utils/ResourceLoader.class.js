import * as THREE from 'three';
import EventEmitter from './EventEmitter.class';

/**
 * ResourceLoader — adapted from threejs-gamedev-template.
 * Keeps the template's manifest-driven loading pipeline (id/type/path,
 * progress/loaded/error events, shared LoadingManager) and adds a
 * 'proceduralAudio' type: buffers synthesized at boot, zero network I/O.
 * Draco/KTX2/GLTF/HDR/Font loaders were removed — VOID SURVIVOR is fully
 * procedural (geometry + canvas textures + synthesized audio).
 */
export default class ResourceLoader extends EventEmitter {
  constructor(assets) {
    super();

    this.sources = assets;
    this.items = {};
    this.sourceByUrl = {};

    this.sources.forEach((src) => {
      const paths = Array.isArray(src.path) ? src.path : [src.path];
      paths.forEach((url) => {
        if (typeof url === 'string') this.sourceByUrl[url] = src;
      });
    });

    this.toLoad = this.sources.length;
    this.loaded = 0;

    this.manager = new THREE.LoadingManager();

    this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const src = this.sourceByUrl[url];
      const id = src ? src.id : String(url);
      this.loaded = itemsLoaded;
      this.trigger('progress', {
        id,
        itemsLoaded,
        itemsTotal,
        percent: (itemsLoaded / itemsTotal) * 100,
      });
    };

    this.manager.onLoad = () => {
      this.trigger('loaded', {
        itemsLoaded: this.toLoad,
        itemsTotal: this.toLoad,
        percent: 100,
      });
    };

    this.manager.onError = (url) => {
      const src = this.sourceByUrl[url];
      this.trigger('error', {
        id: src ? src.id : String(url),
        url,
        itemsLoaded: this.loaded,
        itemsTotal: this.toLoad,
      });
    };

    this.setLoaders();
    this.initLoading();

    if (this.toLoad === 0) {
      setTimeout(() => this.manager.onLoad(), 0);
    }
  }

  setLoaders() {
    this.loaders = {};
    this.loaders.textureLoader = new THREE.TextureLoader(this.manager);
    // AudioContext is created lazily on first user gesture (autoplay policy);
    // decoding uses it when available, otherwise a temporary offline context.
    this.audioContext = null;
  }

  /** Register an already-decoded buffer (procedural synthesis path). */
  addBuffer(id, audioBuffer) {
    this.items[id] = audioBuffer;
  }

  initLoading() {
    for (const source of this.sources) {
      const { type, path, id } = source;
      const onLoad = (file) => {
        this.items[id] = file;
      };

      switch (type) {
        case 'texture':
          this.loaders.textureLoader.load(path, onLoad, undefined);
          break;
        case 'audio':
          this.loadAudio(path, id);
          break;
        case 'proceduralAudio':
          // Synthesized at boot by Audio/Synth.js; counted as loaded.
          // Deferred so subscribers can attach before 'loaded' fires.
          this.manager.itemStart(id);
          setTimeout(() => this.manager.itemEnd(id), 0);
          break;
        default:
          console.warn(`Unknown asset type: ${type}`);
          this.manager.itemStart(id);
          setTimeout(() => this.manager.itemEnd(id), 0);
      }
    }
  }

  loadAudio(path, id) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      console.warn('AudioContext not available, skipping audio load:', id);
      this.manager.itemEnd(path);
      return;
    }
    const ctx = this.audioContext || new Ctx();
    this.manager.itemStart(path);

    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load audio: ${response.statusText}`);
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        this.items[id] = audioBuffer;
        this.manager.itemEnd(path);
      })
      .catch((error) => {
        console.error(`Error loading audio ${id}:`, error);
        this.manager.itemError(path);
      });
  }
}