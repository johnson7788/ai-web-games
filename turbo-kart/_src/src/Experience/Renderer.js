import * as THREE from "three"
import Experience from "./Experience.js"

export default class Renderer {
    constructor() {
        this.experience = new Experience()
        this.canvas = this.experience.canvas
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.camera = this.experience.camera

        this.setInstance()
    }

    setInstance() {
        this.instance = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true
        })

        // NOTE: shadowMap / toneMapping are NOT WebGLRenderer constructor
        // options (they were silently ignored upstream). Set them explicitly.
        // Legacy (non-physical) light units keep the toon colors vibrant —
        // physicallyCorrectLights blew every ground color out to white.
        this.instance.shadowMap.enabled = true
        this.instance.shadowMap.type = THREE.PCFSoftShadowMap

        this.instance.setSize(this.sizes.width, this.sizes.height)
        this.instance.setPixelRatio(this.sizes.devicePixelRatio)
        this.instance.setClearColor('#211d20')
    }

    resize() {
        this.instance.setSize(this.sizes.width, this.sizes.height)
        this.instance.setPixelRatio(this.sizes.devicePixelRatio)
    }

    update() {
        this.instance.render(this.scene, this.camera.instance)
    }
}