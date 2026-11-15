import * as THREE from 'three'
import Sizes from "./Utils/Sizes.js"
import Time from "./Utils/Time.js"
import Camera from "./Camera.js"
import Renderer from './Renderer.js'
import World from './World/World.js'
import Debug from './Utils/Debug.js'
import PhysicsWorld from './PhysicsWorld.js'
import GameSettings from './GameSettings.js'

let instance = null

export default class Experience {
    constructor(canvas) {
        // Singleton
        if (instance) {
            return instance
        }

        instance = this

        // Options
        this.canvas = canvas

        // Setup
        this.debug = new Debug()
        this.sizes = new Sizes()
        this.time = new Time()
        this.scene = new THREE.Scene()
        this.worldPhysics = new PhysicsWorld()
        this.camera = new Camera()
        this.renderer = new Renderer()

        this.world = new World()

        // Access simpleCar directly from world
        if (this.world.simpleCar) {
            this.simpleCar = this.world.simpleCar
        }
        
        // Initialize game settings GUI (after world is created)
        this.gameSettings = new GameSettings()
        this.setupSettingsCallbacks()

        // Sizes resize event
        this.sizes.on('resize', () => {
            this.resize()
        })

        // Time tick event
        this.time.on('tick', () => {
            this.update()
        })
    }
    
    setupSettingsCallbacks() {
        // Car color changes
        this.gameSettings.on('onCarColorChange', (color) => {
            if (this.simpleCar?.updateColor) {
                this.simpleCar.updateColor(color)
            }
        })
        
        // Camera changes
        this.gameSettings.on('onCameraChange', (settings) => {
            if (this.camera?.updateSettings) {
                this.camera.updateSettings(settings)
            }
        })
        
        // Gameplay changes
        this.gameSettings.on('onGameplayChange', (settings) => {
            if (this.world?.gameManager?.updateSettings) {
                this.world.gameManager.updateSettings(settings)
            }
        })
        
        // Appearance changes
        this.gameSettings.on('onAppearanceChange', (data) => {
            if (data.type === 'grass' && this.world?.floor?.updateGrassColor) {
                this.world.floor.updateGrassColor(data.value)
            }
            if (data.type === 'fence' && this.world?.floor?.updateFenceColor) {
                this.world.floor.updateFenceColor(data.value)
            }
            if (data.type === 'shadows') {
                this.renderer.instance.shadowMap.enabled = data.value
            }
        })
        
        // Actions
        this.gameSettings.callbacks.onAction = [(data) => {
            if (data.type === 'resetCar' && this.simpleCar?.resetPosition) {
                this.simpleCar.resetPosition()
            }
            if (data.type === 'restartGame' && this.world?.gameManager?.restartGame) {
                this.world.gameManager.restartGame()
            }
            if (data.type === 'respawnCoins' && this.world?.gameManager?.spawnCoins) {
                this.world.gameManager.spawnCoins()
            }
        }]
    }

    resize() {
        this.camera.resize()
        this.renderer.resize()
    }

    update() {
        this.camera.update()
        this.renderer.update()
        this.worldPhysics.update()

        if (this.simpleCar) {
            this.simpleCar.update()
        }

        // Sun/shadow frustum follows the kart
        if (this.world?.environment?.update) {
            this.world.environment.update()
        }

        // Update world (game manager, etc.)
        if (this.world) {
            this.world.update()
        }
    }

    destroy() {
        this.sizes.off('resize')
        this.time.off('tick')

        this.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose()

                for (const key in child.material) {
                    const value = child.material[key]

                    if (value && typeof value.dispose === 'function') {
                        value.dispose()
                    }
                }
            }
        })

        if (this.camera.controls) {
            this.camera.controls.dispose()
        }
        this.renderer.instance.dispose()

        if (this.debug.active) {
            this.debug.gui.destroy()
        }
        
        if (this.gameSettings) {
            this.gameSettings.destroy()
        }
    }
}