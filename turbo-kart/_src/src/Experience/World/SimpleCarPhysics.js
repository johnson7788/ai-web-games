import * as CANNON from 'cannon-es'
import Experience from '../Experience.js'
import SimpleCar from './SimpleCar.js'
import * as THREE from 'three'

export default class SimpleCarPhysics {
    constructor() {
        this.simpleCar = new SimpleCar()
        this.experience = new Experience()
        this.scene = this.experience.scene

        this.setPhysics()
    }

    setPhysics() {
        const wheelMaterial = new CANNON.Material('wheel')
        const down = new CANNON.Vec3(0, -1, 0)
        const wheelMass = 1.0

        // Chassis - properly balanced for stable driving
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.05, 0.35, 1.65))
        const chassisBody = new CANNON.Body({ mass: 16, shape: chassisShape })
        chassisBody.position.set(55, 1.35, 5)
        chassisBody.allowSleep = false
        
        // Lower center of mass for stability
        chassisBody.shapeOffsets[0] = new CANNON.Vec3(0, -0.2, 0)

        // Extra collider shapes so the visual add-ons have physics too
        // Nose
        chassisBody.addShape(
            new CANNON.Box(new CANNON.Vec3(0.75, 0.22, 0.45)),
            new CANNON.Vec3(0, -0.18, 1.9)
        )
        // Front bumper
        chassisBody.addShape(
            new CANNON.Box(new CANNON.Vec3(0.9, 0.12, 0.18)),
            new CANNON.Vec3(0, -0.35, 2.2)
        )
        // Rear engine block
        chassisBody.addShape(
            new CANNON.Box(new CANNON.Vec3(0.55, 0.14, 0.28)),
            new CANNON.Vec3(0, -0.25, -1.75)
        )
        // Wing (high, thin)
        chassisBody.addShape(
            new CANNON.Box(new CANNON.Vec3(0.8, 0.05, 0.23)),
            new CANNON.Vec3(0, 0.35, -1.95)
        )
        
        // Balanced damping - slightly freer so it feels faster
        chassisBody.linearDamping = 0.25
        chassisBody.angularDamping = 0.7
        
        this.vehicle = new CANNON.RigidVehicle({ chassisBody })

        // Wheel setup - proper sizing
        const wheelRadius = 0.52
        
        // IMPORTANT: wheels must sit below chassis so they actually touch the ground.
        const wheelPositions = [
            { x: 1.0, y: -0.55, z: -1.0 },   // rear right (wheel 0)
            { x: -1.0, y: -0.55, z: -1.0 },  // rear left (wheel 1)
            { x: 1.0, y: -0.55, z: 1.2 },    // front right (wheel 2)
            { x: -1.0, y: -0.55, z: 1.2 }    // front left (wheel 3)
        ]

        wheelPositions.forEach((pos) => {
            const wheelShape = new CANNON.Sphere(wheelRadius)
            const wheelBody = new CANNON.Body({ mass: wheelMass, material: wheelMaterial })
            wheelBody.addShape(wheelShape)
            wheelBody.allowSleep = false
            
            // Proper axis for wheels (perpendicular to movement)
            const axis = new CANNON.Vec3(1, 0, 0)
            
            this.vehicle.addWheel({
                body: wheelBody,
                position: new CANNON.Vec3(pos.x, pos.y, pos.z),
                axis: axis,
                direction: down
            })
            
            // Wheel damping for stability
            wheelBody.linearDamping = 0.3
            wheelBody.angularDamping = 0.5
        })

        this.vehicle.addToWorld(this.experience.worldPhysics.instance)
        
        // Wheel-ground contact - good grip with appropriate bounce
        const groundMaterial = new CANNON.Material('ground')
        const wheelGroundContact = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
            friction: 1.0,
            restitution: 0.01
        })
        this.experience.worldPhysics.instance.addContactMaterial(wheelGroundContact)

        // Add meshes to the scene
        this.scene.add(this.simpleCar.simpleCarModel.chassisMesh)
        this.scene.add(this.simpleCar.simpleCarModel.frontWheelMesh1)
        this.scene.add(this.simpleCar.simpleCarModel.frontWheelMesh2)
        this.scene.add(this.simpleCar.simpleCarModel.rearWheelMesh1)
        this.scene.add(this.simpleCar.simpleCarModel.rearWheelMesh2)
    }

    update() {
        // Physics update handled in PhysicsWorld
    }
}