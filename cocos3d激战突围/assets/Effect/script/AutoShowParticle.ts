import { _decorator, Component, Node, ParticleSystem, Vec3, v3 } from 'cc';
import { BasicComponet } from '../../Init/Basic/BasicComponet';
import { GlobalTmpData } from '../../Init/Config/GlobalTmpData';
import GlobalPool from '../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('AutoShowParticle')
export class AutoShowParticle extends BasicComponet {
    @property
    hideTime = 1;

    curt = 0;
    particle: ParticleSystem = null;
    particleArr: ParticleSystem[] = [];

    initSub() {
        this.particle = this.node.getComponent(ParticleSystem);
        this.particleArr = this.node.getComponentsInChildren(ParticleSystem);
    }

    setData(d?) {
        this.curt = 0;
        this.particle && this.particle.play();
        if (this.particleArr) {
            this.particleArr.forEach(e => { e.play() });
        }
    }

    reset() {
        this.curt = 0;
        this.particle && this.particle.stop();
        if (this.particleArr) {
            this.particleArr.forEach(e => { e.stop() });
        }
    }
    tmpPos = v3();
    update(dt: number) {
        this.curt += dt;
        
        this.tmpPos.set(GlobalTmpData.Player.wpos).add(GlobalTmpData.Player.offset);
        this.node.setPosition(this.tmpPos);

        if (this.curt >= this.hideTime) {
            this.particle && this.particle.stop();
            if (this.particleArr) {
                this.particleArr.forEach(e => { e.stop() });
            }
            GlobalPool.put(this.node);
        }
    }
}

