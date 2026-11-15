import * as THREE from "three"
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Experience from "./Experience.js"

export default class Camera {
    constructor() {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas

        // Camera modes
        this.testingMode = false // Set to true for orbit controls
        
        // Third-person camera settings (can be updated via GameSettings)
        this.cameraSettings = {
            distance: 12,
            height: 6,
            smoothness: 0.08,
            fov: 50,
            lookAheadDistance: 5
        }
        
        // Camera state
        this.targetPosition = new THREE.Vector3()
        this.currentLookAt = new THREE.Vector3()

        this.setInstance()

        if (this.testingMode) {
            this.setOrbitControls()
        }
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(
            this.cameraSettings.fov,
            this.sizes.width / this.sizes.height,
            0.1,
            1000
        )

        this.instance.position.set(5, 15, 25)
        this.instance.lookAt(new THREE.Vector3(5, 0, 0))
        this.scene.add(this.instance)
    }

    setOrbitControls() {
        this.controls = new OrbitControls(
            this.instance,
            this.canvas
        )

        this.controls.enableDamping = true
        this.controls.target.set(5, 5, 0)
    }
    
    // Update camera settings from GameSettings
    updateSettings(settings) {
        if (settings.distance !== undefined) this.cameraSettings.distance = settings.distance
        if (settings.height !== undefined) this.cameraSettings.height = settings.height
        if (settings.smoothness !== undefined) this.cameraSettings.smoothness = settings.smoothness
        if (settings.fov !== undefined) {
            this.cameraSettings.fov = settings.fov
            this.instance.fov = settings.fov
            this.instance.updateProjectionMatrix()
        }
    }
    
    // Third-person follow camera update
    followTarget(target, forward) {
        if (this.testingMode || !target) return
        
        const { distance, height, smoothness, lookAheadDistance } = this.cameraSettings
        
        // Calculate ideal camera position behind the target
        const offset = forward.clone().multiplyScalar(-distance)
        offset.y = height
        
        this.targetPosition.copy(target).add(offset)
        
        // Smooth camera movement
        this.instance.position.lerp(this.targetPosition, smoothness)
        
        // Look ahead of the car
        const lookAtPoint = target.clone()
        lookAtPoint.add(forward.clone().multiplyScalar(lookAheadDistance))
        lookAtPoint.y = target.y + 1
        
        // Smooth look-at
        this.currentLookAt.lerp(lookAtPoint, smoothness * 1.5)
        this.instance.lookAt(this.currentLookAt)
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    update() {
        if (this.testingMode && this.controls) {
            this.controls.update()
        }
    }
}