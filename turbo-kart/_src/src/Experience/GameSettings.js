import GUI from 'lil-gui'
import Experience from './Experience.js'

/**
 * GameSettings - Central settings manager with lil-gui controls
 * Controls appearance, gameplay, and debug parameters
 */
export default class GameSettings {
    constructor() {
        this.experience = new Experience()
        
        // Default settings
        this.settings = {
            // Appearance
            appearance: {
                carColor: '#FF0000',
                roadColor: '#2C2C2C',
                grassColor: '#22CC44',
                skyBrightness: 1.0,
                showShadows: true,
                fenceColor: '#FF3D00'
            },
            // Gameplay
            gameplay: {
                coinValue: 10,
                timeLimit: 120, // seconds
                enableJump: true
            },
            // Camera
            camera: {
                distance: 10,
                height: 6,
                smoothness: 0.15,
                fov: 50
            },
            // Physics (read-only display)
            physics: {
                showDebug: false
            }
        }
        
        // Callbacks for when settings change
        this.callbacks = {
            onCarColorChange: [],
            onCameraChange: [],
            onGameplayChange: [],
            onAppearanceChange: []
        }
        
        this.initGUI()
    }
    
    initGUI() {
        // Create main GUI panel
        this.gui = new GUI({ title: '🎮 Game Settings' })
        this.gui.close() // Start closed
        
        // Style the GUI (below the platform language toggle in the top-right corner)
        this.gui.domElement.style.position = 'fixed'
        this.gui.domElement.style.top = '48px'
        this.gui.domElement.style.right = '10px'
        this.gui.domElement.style.zIndex = '1000'
        
        this.setupAppearanceFolder()
        this.setupCameraFolder()
        this.setupGameplayFolder()
        this.setupActionsFolder()
    }
    
    setupAppearanceFolder() {
        const folder = this.gui.addFolder('🎨 Appearance')
        
        folder.addColor(this.settings.appearance, 'carColor')
            .name('Car Color')
            .onChange((value) => {
                this.triggerCallbacks('onCarColorChange', value)
            })
        
        folder.addColor(this.settings.appearance, 'grassColor')
            .name('Grass Color')
            .onChange((value) => {
                this.triggerCallbacks('onAppearanceChange', { type: 'grass', value })
            })
        
        folder.addColor(this.settings.appearance, 'fenceColor')
            .name('Fence Color')
            .onChange((value) => {
                this.triggerCallbacks('onAppearanceChange', { type: 'fence', value })
            })
        
        folder.add(this.settings.appearance, 'skyBrightness', 0.5, 1.5, 0.1)
            .name('Sky Brightness')
            .onChange((value) => {
                this.triggerCallbacks('onAppearanceChange', { type: 'sky', value })
            })
        
        folder.add(this.settings.appearance, 'showShadows')
            .name('Show Shadows')
            .onChange((value) => {
                this.triggerCallbacks('onAppearanceChange', { type: 'shadows', value })
            })
    }
    
    setupCameraFolder() {
        const folder = this.gui.addFolder('📷 Camera')
        
        folder.add(this.settings.camera, 'distance', 5, 20, 1)
            .name('Distance')
            .onChange(() => this.triggerCallbacks('onCameraChange', this.settings.camera))
        
        folder.add(this.settings.camera, 'height', 3, 15, 0.5)
            .name('Height')
            .onChange(() => this.triggerCallbacks('onCameraChange', this.settings.camera))
        
        folder.add(this.settings.camera, 'smoothness', 0.05, 0.5, 0.01)
            .name('Smoothness')
            .onChange(() => this.triggerCallbacks('onCameraChange', this.settings.camera))
        
        folder.add(this.settings.camera, 'fov', 30, 90, 5)
            .name('Field of View')
            .onChange(() => this.triggerCallbacks('onCameraChange', this.settings.camera))
    }
    
    setupGameplayFolder() {
        const folder = this.gui.addFolder('🎯 Gameplay')
        
        folder.add(this.settings.gameplay, 'coinValue', 5, 50, 5)
            .name('Coin Value')
            .onChange(() => this.triggerCallbacks('onGameplayChange', this.settings.gameplay))
        
        folder.add(this.settings.gameplay, 'timeLimit', 30, 300, 10)
            .name('Time Limit (s)')
            .onChange(() => this.triggerCallbacks('onGameplayChange', this.settings.gameplay))
        
        folder.add(this.settings.gameplay, 'enableJump')
            .name('Enable Jump')
            .onChange(() => this.triggerCallbacks('onGameplayChange', this.settings.gameplay))
    }
    
    setupActionsFolder() {
        // Actions folder removed - using keyboard controls instead
    }
    
    // Register callback
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback)
        }
    }
    
    // Remove callback
    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback)
            if (index > -1) {
                this.callbacks[event].splice(index, 1)
            }
        }
    }
    
    // Trigger callbacks
    triggerCallbacks(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(cb => cb(data))
        }
    }
    
    // Get current settings
    getSettings() {
        return this.settings
    }
    
    // Update a setting programmatically
    updateSetting(category, key, value) {
        if (this.settings[category] && this.settings[category][key] !== undefined) {
            this.settings[category][key] = value
            this.gui.controllers.forEach(c => c.updateDisplay())
        }
    }
    
    destroy() {
        if (this.gui) {
            this.gui.destroy()
        }
    }
}
