import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import Experience from "../Experience.js";
import Environment from "./Environment.js";
import Floor from "./Floor.js";
import SimpleCar from "./SimpleCar.js";
import SimpleCarController from "./SimpleCarController.js";
import GameManager from "./GameManager.js";

export default class World {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene

        // Setup the world
        this.floor = new Floor()
        this.simpleCar = new SimpleCar()
        this.simpleCarController = new SimpleCarController()
        this.environment = new Environment()
        
        // Add game elements (coins, score, timer)
        this.gameManager = new GameManager()
        
        // Track last boost time to prevent spam
        this.lastBoostTime = 0
    }

    update() {
        // Update game manager
        if (this.gameManager) {
            this.gameManager.update()
        }
        
        // Check for boost pads
        if (this.simpleCar?.chassisMesh && this.floor) {
            const boostPad = this.floor.checkBoostPads(this.simpleCar.chassisMesh.position)
            if (boostPad && Date.now() - this.lastBoostTime > 2000) {
                this.applyBoost()
                this.lastBoostTime = Date.now()
            }
        }
    }
    
    applyBoost() {
        // Apply forward boost to the car
        const car = this.simpleCar
        if (!car?.vehicle?.chassisBody) return
        
        const forward = car.getForwardDirection()
        const boostForce = 80
        
        car.vehicle.chassisBody.applyImpulse(
            new CANNON.Vec3(forward.x * boostForce, 0, forward.z * boostForce),
            new CANNON.Vec3(0, 0, 0)
        )
        
        // Play boost sound in GameManager
        if (this.gameManager?.playSound) {
            this.gameManager.playSound(400, 0.1)
            setTimeout(() => this.gameManager.playSound(600, 0.1), 50)
            setTimeout(() => this.gameManager.playSound(800, 0.15), 100)
        }
    }
}