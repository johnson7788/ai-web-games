/**
 * Lightweight ECS core for VOID SURVIVOR.
 * Entities are integer ids; components are plain data objects stored in
 * per-component Maps; systems are ordered objects with update(dt).
 * Built on the template's Game/Time/EventEmitter architecture.
 */
export default class ECS {
  constructor() {
    this.entities = new Set();
    this.nextId = 1;
    this.stores = new Map();
    this.systems = [];
    this._queryCache = new Map();
  }

  create() {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  add(id, name, data) {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    store.set(id, data);
    this._queryCache.clear();
    return data;
  }

  get(id, name) {
    const store = this.stores.get(name);
    return store ? store.get(id) : undefined;
  }

  has(id, name) {
    const store = this.stores.get(name);
    return store ? store.has(id) : false;
  }

  removeComponent(id, name) {
    const store = this.stores.get(name);
    if (store) store.delete(id);
    this._queryCache.clear();
  }

  /** Destroy an entity; caller is responsible for disposing its view. */
  destroy(id) {
    for (const store of this.stores.values()) store.delete(id);
    this.entities.delete(id);
    this._queryCache.clear();
  }

  /** Ids that own every listed component. */
  query(...names) {
    const key = names.join('|');
    const cached = this._queryCache.get(key);
    if (cached) return cached;
    const first = this.stores.get(names[0]);
    const out = [];
    if (first) {
      outer: for (const id of first.keys()) {
        for (let i = 1; i < names.length; i++) {
          const s = this.stores.get(names[i]);
          if (!s || !s.has(id)) continue outer;
        }
        out.push(id);
      }
    }
    this._queryCache.set(key, out);
    return out;
  }

  addSystem(system) {
    this.systems.push(system);
    return system;
  }

  update(dt) {
    for (const system of this.systems) system.update(dt);
  }

  clear() {
    this.entities.clear();
    this.stores.clear();
    this._queryCache.clear();
  }
}