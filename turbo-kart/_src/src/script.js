import './style.css'
import Experience from './Experience/Experience.js'

const experience = new Experience(document.querySelector('canvas.webgl'))

// Test/debug hook (used by smoke tests; harmless in production)
window.__turboKart = experience