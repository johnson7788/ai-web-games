import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import Experience from '../Experience.js'

export default class Floor {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.worldPhysics = this.experience.worldPhysics.instance
        
        // Vibrant Nintendo racing colors
        this.nintendoColors = {
            trackColor: 0x444444,         // Darker track
            roadColor: 0x555555,          // Main road
            roadStripeColor: 0xFFFFFF,    // Pure white stripes
            grassColor: 0x44BB44,         // Vibrant green grass
            grassColorAlt: 0x33AA33,      // Alternate grass for pattern
            fenceColor: 0xE63939,         // Red fence
            fenceAccent: 0xFFFFFF,        // White accents
            boostPadColor: 0xFF6600,      // Orange boost pads
            boostArrowColor: 0xFFDD00     // Yellow arrows
        }
        
        // Store meshes for updates
        this.fenceMeshes = []
        this.grassMeshes = []
        this.boostPads = []
        
        // Build the track
        this.createTrack()
        this.setPhysics()
        this.addBoostPads()
        this.addNintendoFences()
        this.addTrees()
    }

    createTrack() {
        // Create a proper race track layout
        
        // Main ground (grass)
        const groundGeometry = new THREE.PlaneGeometry(200, 200)
        const groundMaterial = new THREE.MeshToonMaterial({
            color: this.nintendoColors.grassColor
        })
        this.groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
        this.groundMesh.rotation.x = -Math.PI * 0.5
        this.groundMesh.receiveShadow = true
        this.scene.add(this.groundMesh)
        this.grassMeshes.push(this.groundMesh)
        
        // Create checkered grass pattern
        this.addGrassPattern()
        
        // Create the main track (oval-ish shape using multiple pieces)
        this.createRoadSurface()
        
        // Add road markings only on the road
        this.addRoadMarkings()
    }
    
    addGrassPattern() {
        // Add alternating grass squares for Mario Kart-like look
        const squareSize = 20
        const grassAltMaterial = new THREE.MeshToonMaterial({
            color: this.nintendoColors.grassColorAlt
        })
        
        for (let x = -80; x < 80; x += squareSize * 2) {
            for (let z = -80; z < 80; z += squareSize * 2) {
                // Create checkered pattern
                const offset = ((x / squareSize) % 2 === 0) ? 0 : squareSize
                
                const square = new THREE.Mesh(
                    new THREE.PlaneGeometry(squareSize, squareSize),
                    grassAltMaterial
                )
                square.position.set(x + offset, 0.005, z)
                square.rotation.x = -Math.PI / 2
                square.receiveShadow = true
                this.scene.add(square)
            }
        }
    }
    
    createRoadSurface() {
        const roadMaterial = new THREE.MeshToonMaterial({
            color: this.nintendoColors.roadColor
        })
        
        // Main circular track
        const trackWidth = 18
        const trackRadius = 50
        
        // Create track using a ring shape
        const trackShape = new THREE.Shape()
        const outerRadius = trackRadius + trackWidth / 2
        const innerRadius = trackRadius - trackWidth / 2
        
        // Outer circle
        trackShape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false)
        
        // Inner circle (hole)
        const hole = new THREE.Path()
        hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true)
        trackShape.holes.push(hole)
        
        const trackGeometry = new THREE.ShapeGeometry(trackShape, 64)
        const trackMesh = new THREE.Mesh(trackGeometry, roadMaterial)
        trackMesh.rotation.x = -Math.PI / 2
        trackMesh.position.y = 0.02
        trackMesh.receiveShadow = true
        this.scene.add(trackMesh)
        
        // Add starting area (straight section)
        const startAreaGeo = new THREE.PlaneGeometry(20, 25)
        const startArea = new THREE.Mesh(startAreaGeo, roadMaterial)
        startArea.rotation.x = -Math.PI / 2
        startArea.position.set(50, 0.02, 0)
        startArea.receiveShadow = true
        this.scene.add(startArea)
        
        // Starting line
        this.addStartingLine()
    }
    
    addStartingLine() {
        // Checkered starting line
        const squareSize = 1.5
        const lineWidth = 18
        const numSquares = Math.floor(lineWidth / squareSize)
        
        const whiteMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF })
        const blackMat = new THREE.MeshToonMaterial({ color: 0x111111 })
        
        for (let i = 0; i < numSquares; i++) {
            for (let row = 0; row < 2; row++) {
                const isWhite = (i + row) % 2 === 0
                const square = new THREE.Mesh(
                    new THREE.PlaneGeometry(squareSize, squareSize),
                    isWhite ? whiteMat : blackMat
                )
                square.position.set(
                    50 + (i - numSquares / 2) * squareSize + squareSize / 2,
                    0.03,
                    10 + row * squareSize
                )
                square.rotation.x = -Math.PI / 2
                this.scene.add(square)
            }
        }
    }

    addRoadMarkings() {
        const lineMaterial = new THREE.MeshBasicMaterial({
            color: this.nintendoColors.roadStripeColor
        })
        
        // Center dashed line around the circular track
        const trackRadius = 50
        const numDashes = 40
        
        for (let i = 0; i < numDashes; i++) {
            const angle = (i / numDashes) * Math.PI * 2
            const x = Math.cos(angle) * trackRadius
            const z = Math.sin(angle) * trackRadius
            
            const dashGeometry = new THREE.PlaneGeometry(0.4, 3)
            const dash = new THREE.Mesh(dashGeometry, lineMaterial)
            dash.position.set(x, 0.025, z)
            dash.rotation.x = -Math.PI / 2
            dash.rotation.z = -angle + Math.PI / 2
            this.scene.add(dash)
        }
        
        // Edge lines (inner and outer)
        const innerRadius = 50 - 8
        const outerRadius = 50 + 8
        
        // Inner edge - solid line
        const innerLine = this.createCircleLine(innerRadius, 0xFFFFFF, 0.3)
        this.scene.add(innerLine)
        
        // Outer edge - solid line
        const outerLine = this.createCircleLine(outerRadius, 0xFFFFFF, 0.3)
        this.scene.add(outerLine)
        
        // Red/white curbs on edges
        this.addCurbs(innerRadius - 0.5, 48)
        this.addCurbs(outerRadius + 0.5, 60)
    }
    
    createCircleLine(radius, color, width) {
        const points = []
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2
            points.push(new THREE.Vector3(
                Math.cos(angle) * radius,
                0.025,
                Math.sin(angle) * radius
            ))
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = new THREE.LineBasicMaterial({ color, linewidth: 2 })
        return new THREE.Line(geometry, material)
    }
    
    addCurbs(radius, numCurbs) {
        const redMat = new THREE.MeshToonMaterial({ color: 0xFF0000 })
        const whiteMat = new THREE.MeshToonMaterial({ color: 0xFFFFFF })
        
        for (let i = 0; i < numCurbs; i++) {
            const angle = (i / numCurbs) * Math.PI * 2
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius
            
            const curb = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 0.1, 0.8),
                i % 2 === 0 ? redMat : whiteMat
            )
            curb.position.set(x, 0.05, z)
            curb.rotation.y = -angle + Math.PI / 2
            this.scene.add(curb)
        }
    }

    addBoostPads() {
        // Add speed boost pads around the track
        const boostPositions = [
            { x: 50, z: -50, angle: Math.PI },      // Bottom of track
            { x: -50, z: 0, angle: Math.PI / 2 },   // Left side
            { x: 0, z: 50, angle: 0 },              // Top of track
            { x: 50, z: 20, angle: -Math.PI / 2 }   // Near start
        ]
        
        boostPositions.forEach(pos => {
            this.createBoostPad(pos.x, pos.z, pos.angle)
        })
    }
    
    createBoostPad(x, z, angle) {
        const padGroup = new THREE.Group()
        
        // Main pad
        const padGeometry = new THREE.PlaneGeometry(6, 3)
        const padMaterial = new THREE.MeshToonMaterial({
            color: this.nintendoColors.boostPadColor,
            emissive: this.nintendoColors.boostPadColor,
            emissiveIntensity: 0.3
        })
        const pad = new THREE.Mesh(padGeometry, padMaterial)
        pad.rotation.x = -Math.PI / 2
        padGroup.add(pad)
        
        // Arrow shapes
        const arrowMaterial = new THREE.MeshToonMaterial({
            color: this.nintendoColors.boostArrowColor,
            emissive: this.nintendoColors.boostArrowColor,
            emissiveIntensity: 0.5
        })
        
        for (let i = 0; i < 2; i++) {
            const arrowShape = new THREE.Shape()
            arrowShape.moveTo(0, 0.8)
            arrowShape.lineTo(0.5, 0)
            arrowShape.lineTo(0.2, 0)
            arrowShape.lineTo(0.2, -0.6)
            arrowShape.lineTo(-0.2, -0.6)
            arrowShape.lineTo(-0.2, 0)
            arrowShape.lineTo(-0.5, 0)
            arrowShape.lineTo(0, 0.8)
            
            const arrowGeo = new THREE.ShapeGeometry(arrowShape)
            const arrow = new THREE.Mesh(arrowGeo, arrowMaterial)
            arrow.rotation.x = -Math.PI / 2
            arrow.position.set(-1 + i * 2, 0.01, 0)
            arrow.scale.set(1.2, 1.2, 1)
            padGroup.add(arrow)
        }
        
        padGroup.position.set(x, 0.03, z)
        padGroup.rotation.y = angle
        this.scene.add(padGroup)
        
        // Store for game logic
        this.boostPads.push({
            mesh: padGroup,
            position: new THREE.Vector3(x, 0, z),
            radius: 4
        })
    }

    addNintendoFences() {
        // Create racing fences around the track perimeter
        const fenceHeight = 1.5
        const outerRadius = 75
        const numPosts = 40
        
        for (let i = 0; i < numPosts; i++) {
            const angle = (i / numPosts) * Math.PI * 2
            const x = Math.cos(angle) * outerRadius
            const z = Math.sin(angle) * outerRadius
            
            this.createFencePost(x, z, angle)
        }
        
        // Add invisible physics walls
        this.addInvisibleWalls()
    }
    
    createFencePost(x, z, angle) {
        const postGroup = new THREE.Group()
        
        // Main post
        const postGeometry = new THREE.BoxGeometry(0.3, 1.5, 0.3)
        const postMaterial = new THREE.MeshToonMaterial({
            color: this.nintendoColors.fenceColor
        })
        const post = new THREE.Mesh(postGeometry, postMaterial)
        post.position.y = 0.75
        post.castShadow = true
        postGroup.add(post)
        
        // White cap
        const capGeometry = new THREE.BoxGeometry(0.4, 0.15, 0.4)
        const capMaterial = new THREE.MeshToonMaterial({
            color: this.nintendoColors.fenceAccent
        })
        const cap = new THREE.Mesh(capGeometry, capMaterial)
        cap.position.y = 1.55
        postGroup.add(cap)
        
        postGroup.position.set(x, 0, z)
        this.scene.add(postGroup)
        this.fenceMeshes.push(postGroup)
        
        // Physics for fence post
        const postBody = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Box(new CANNON.Vec3(0.3, 1, 0.3)),
            position: new CANNON.Vec3(x, 1, z)
        })
        this.worldPhysics.addBody(postBody)
    }
    
    addTrees() {
        // Add trees outside the track
        const treePositions = []
        const outerRadius = 85
        
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.2
            const radius = outerRadius + 5 + Math.random() * 10
            treePositions.push({
                x: Math.cos(angle) * radius,
                z: Math.sin(angle) * radius
            })
        }
        
        treePositions.forEach(pos => {
            this.createNintendoTree(pos.x, pos.z)
        })
    }
    
    createNintendoTree(x, z) {
        const treeGroup = new THREE.Group()
        
        // Trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 2, 8)
        const trunkMaterial = new THREE.MeshToonMaterial({ color: 0x8B4513 })
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
        trunk.position.y = 1
        trunk.castShadow = true
        treeGroup.add(trunk)
        
        // Foliage (3 stacked cones)
        const foliageMaterial = new THREE.MeshToonMaterial({ color: 0x228B22 })
        
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(2, 2.5, 8), foliageMaterial)
        cone1.position.y = 3
        cone1.castShadow = true
        treeGroup.add(cone1)
        
        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2, 8), foliageMaterial)
        cone2.position.y = 4.5
        cone2.castShadow = true
        treeGroup.add(cone2)
        
        const cone3 = new THREE.Mesh(new THREE.ConeGeometry(1, 1.5, 8), foliageMaterial)
        cone3.position.y = 5.8
        cone3.castShadow = true
        treeGroup.add(cone3)
        
        treeGroup.position.set(x, 0, z)
        treeGroup.rotation.y = Math.random() * Math.PI * 2
        
        // Slight random scale for variety
        const scale = 0.8 + Math.random() * 0.6
        treeGroup.scale.set(scale, scale, scale)
        
        this.scene.add(treeGroup)

        // Physics collider (static trunk)
        // Cannon cylinder is oriented along X by default; rotate it to align with Y.
        const trunkRadiusTop = 0.3 * scale
        const trunkRadiusBottom = 0.5 * scale
        const trunkHeight = 2 * scale
        const trunkShape = new CANNON.Cylinder(trunkRadiusTop, trunkRadiusBottom, trunkHeight, 8)
        const trunkBody = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: trunkShape,
            position: new CANNON.Vec3(x, (trunkHeight / 2), z)
        })
        trunkBody.quaternion.setFromEuler(Math.PI / 2, 0, 0)
        this.worldPhysics.addBody(trunkBody)
    }

    setPhysics() {
        // Main ground
        this.body = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Box(new CANNON.Vec3(100, 0.1, 100))
        })
        this.body.position.y = -0.1
        
        const material = new CANNON.Material('floorMaterial')
        material.friction = 0.5
        material.restitution = 0.1
        this.body.material = material
        
        this.worldPhysics.addBody(this.body)
    }

    addInvisibleWalls() {
        const wallHeight = 8
        const arenaSize = 80
        
        const wallConfigs = [
            { pos: [0, wallHeight/2, -arenaSize], size: [100, wallHeight, 2] },
            { pos: [0, wallHeight/2, arenaSize], size: [100, wallHeight, 2] },
            { pos: [-arenaSize, wallHeight/2, 0], size: [2, wallHeight, 100] },
            { pos: [arenaSize, wallHeight/2, 0], size: [2, wallHeight, 100] }
        ]
        
        const wallMaterial = new CANNON.Material('wallMaterial')
        wallMaterial.friction = 0.1
        wallMaterial.restitution = 0.3
        
        wallConfigs.forEach(config => {
            const wallBody = new CANNON.Body({
                type: CANNON.Body.STATIC,
                shape: new CANNON.Box(new CANNON.Vec3(config.size[0], config.size[1], config.size[2]))
            })
            wallBody.position.set(config.pos[0], config.pos[1], config.pos[2])
            wallBody.material = wallMaterial
            this.worldPhysics.addBody(wallBody)
        })
    }
    
    // Check if car is on a boost pad
    checkBoostPads(carPosition) {
        for (const pad of this.boostPads) {
            const distance = new THREE.Vector2(
                carPosition.x - pad.position.x,
                carPosition.z - pad.position.z
            ).length()
            
            if (distance < pad.radius) {
                return pad
            }
        }
        return null
    }
    
    updateGrassColor(color) {
        this.nintendoColors.grassColor = color
        this.grassMeshes.forEach(mesh => {
            if (mesh.material) {
                mesh.material.color.set(color)
            }
        })
    }
    
    updateFenceColor(color) {
        this.nintendoColors.fenceColor = color
        this.fenceMeshes.forEach(mesh => {
            mesh.traverse(child => {
                if (child.material && child.material.color) {
                    const hex = child.material.color.getHex()
                    if (hex !== 0xFFFFFF) {
                        child.material.color.set(color)
                    }
                }
            })
        })
    }
}
