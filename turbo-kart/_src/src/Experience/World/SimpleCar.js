import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Experience from '../Experience.js'
import SimpleCarModel from './SimpleCarModel.js'
import SimpleCarPhysics from './SimpleCarPhysics.js'

let instance = null

export default class SimpleCar {
    constructor() {
        // Singleton
        if (instance) {
            return instance
        }

        instance = this

        this.experience = new Experience()
        this.scene = this.experience.scene

        this.simpleCarModel = new SimpleCarModel()
        this.simpleCarPhysics = new SimpleCarPhysics()

        this.vehicle = this.simpleCarPhysics.vehicle

        this.time = this.experience.time

        this.frontWheelMesh1 = this.simpleCarModel.frontWheelMesh1
        this.frontWheelMesh2 = this.simpleCarModel.frontWheelMesh2
        this.rearWheelMesh1 = this.simpleCarModel.rearWheelMesh1
        this.rearWheelMesh2 = this.simpleCarModel.rearWheelMesh2
        this.chassisMesh = this.simpleCarModel.chassisMesh
        
        // For camera tracking
        this.forwardDirection = new THREE.Vector3(0, 0, 1)
        this.tempQuat = new THREE.Quaternion()
    }
    
    // Get the car's forward direction for camera
    getForwardDirection() {
        if (!this.chassisMesh) return this.forwardDirection
        
        // Get forward direction from chassis rotation
        this.tempQuat.copy(this.chassisMesh.quaternion)
        this.forwardDirection.set(0, 0, 1)
        this.forwardDirection.applyQuaternion(this.tempQuat)
        this.forwardDirection.y = 0
        this.forwardDirection.normalize()
        
        return this.forwardDirection
    }
    
    // Get car position
    getPosition() {
        if (!this.chassisMesh) return new THREE.Vector3(5, 0, 0)
        return this.chassisMesh.position.clone()
    }
    
    // Update car color from settings
    updateColor(colorHex) {
        if (this.chassisMesh && this.chassisMesh.children) {
            this.chassisMesh.children.forEach(child => {
                if (child.material && child.material.color) {
                    // Only update the main body, not windows or other parts
                    const currentHex = child.material.color.getHex()
                    // Check if it's a bright color (not black/gray for windows)
                    if (currentHex > 0x333333) {
                        child.material.color.set(colorHex)
                        if (child.material.emissive) {
                            child.material.emissive.set(colorHex)
                            child.material.emissiveIntensity = 0.1
                        }
                    }
                }
            })
        }
    }
    
    // Teleport the wheel bodies WITH the chassis. They are real dynamic
    // bodies attached by hinge constraints — leaving them at the old spot
    // would yank the kart back toward where it used to be.
    _syncWheelsToChassis() {
        const chassis = this.vehicle.chassisBody
        const wheels = this.vehicle.wheelBodies || []
        wheels.forEach((wheel, i) => {
            const pivot = this.vehicle.constraints && this.vehicle.constraints[i] && this.vehicle.constraints[i].pivotA
            if (pivot) {
                chassis.pointToWorldFrame(pivot, wheel.position)
            }
            wheel.quaternion.copy(chassis.quaternion)
            wheel.velocity.setZero()
            wheel.angularVelocity.setZero()
            wheel.wakeUp()
        })

        // Straighten the steering
        for (let i = 0; i < wheels.length; i++) {
            this.vehicle.setSteeringValue(0, i)
        }
    }

    // Reset car position
    resetPosition() {
        const chassis = this.vehicle.chassisBody
        if (!chassis) return

        // Stop all motion first
        chassis.velocity.setZero()
        chassis.angularVelocity.setZero()

        // Reset position - on the starting line
        chassis.position.set(55, 2, 5)

        // Reset rotation to face the racing direction (same as initial spawn:
        // forward +z along the start straight)
        chassis.quaternion.set(0, 0, 0, 1)

        // Wake up the body
        chassis.wakeUp()

        this._syncWheelsToChassis()
    }

    // Flip recovery: put the kart back on its wheels at the same spot,
    // keeping its heading. Used by the controller's auto-right logic so a
    // rolled kart is never a soft-lock.
    rightInPlace() {
        const chassis = this.vehicle.chassisBody
        if (!chassis) return

        // Keep current heading (yaw only), drop roll/pitch
        const fwd = new CANNON.Vec3(0, 0, 1)
        chassis.quaternion.vmult(fwd, fwd)
        const yaw = Math.atan2(fwd.x, fwd.z)

        chassis.velocity.setZero()
        chassis.angularVelocity.setZero()
        chassis.position.y = Math.max(chassis.position.y, 1.2) + 0.6
        chassis.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), yaw)
        chassis.wakeUp()

        this._syncWheelsToChassis()
    }

    update() {
        if (this.chassisMesh) {
            this.simpleCarModel.updateMeshPosition(this.chassisMesh, this.vehicle.chassisBody)
        }

        if (this.frontWheelMesh1) {
            this.simpleCarModel.updateMeshPosition(this.frontWheelMesh1, this.vehicle.wheelBodies[2])
        }

        if (this.frontWheelMesh2) {
            this.simpleCarModel.updateMeshPosition(this.frontWheelMesh2, this.vehicle.wheelBodies[3])
        }

        if (this.rearWheelMesh1) {
            this.simpleCarModel.updateMeshPosition(this.rearWheelMesh1, this.vehicle.wheelBodies[0])
        }

        if (this.rearWheelMesh2) {
            this.simpleCarModel.updateMeshPosition(this.rearWheelMesh2, this.vehicle.wheelBodies[1])
        }
        
        // Update camera to follow car
        if (!this.experience.camera.testingMode && this.chassisMesh) {
            this.experience.camera.followTarget(
                this.chassisMesh.position,
                this.getForwardDirection()
            )
        }

        // Apply driving inputs (speed-sensitive steering, throttle)
        const controller = this.experience.world?.simpleCarController
        if (controller && controller.update) {
            controller.update()
        }
    }
}