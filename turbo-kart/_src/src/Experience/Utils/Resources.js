import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import EventEmitter from "./EventEmitter.js"

// NOTE: Draco decoding removed for the static/sandbox build — the kart and track
// are 100% procedural (see sources.js), so no compressed models are ever loaded
// and no Web Worker is required (sandboxed iframes forbid Workers).

export default class Resources extends EventEmitter {
    constructor(sources) {
        super()

        this.sources = sources

        // Setup
        this.items = {}
        this.toLoad = this.sources.length

        // console.log('Resources to load:', this.toLoad)

        this.loaded = 0

        this.loadingManager = new THREE.LoadingManager()

        this.setLoaders()
        this.startLoading()
    }

    setLoaders() {
        this.loaders = {}
        this.loaders.gltfLoader = new GLTFLoader(this.loadingManager)
        this.loaders.textureLoader = new THREE.TextureLoader(this.loadingManager)
    }

    startLoading() {
        // Load each item
        for (const source of this.sources) {
            if (source.type === 'gltfModel') {
                this.loaders.gltfLoader.load(
                    source.path,
                    (gltf) => {
                        this.sourceLoaded(source, gltf)
                    }
                )
            } else if (source.type === 'texture') {
                this.loaders.textureLoader.load(
                    source.path,
                    (texture) => {
                        this.sourceLoaded(source, texture)
                    }
                )
            }
        }
    }

    sourceLoaded(source, file){
        this.items[source.name] = file

        this.loaded++

        if (this.loaded === this.toLoad) {
            this.trigger('ready')
        }

    }

}