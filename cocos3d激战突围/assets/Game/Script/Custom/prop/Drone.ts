import { _decorator, Component, Node, v3, Quat, Vec3 } from 'cc';
import { GlobalConfig, WeaponCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import EventManager from '../../../../Init/Managers/EventManager';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { AudioEnum } from '../../../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../../../Init/SystemAudio/AudioSystem';
import Tools from '../../../../Init/Tools/Tools';
import { ModifyPosRotMesh } from './ModifyPosRotMesh';
const { ccclass, property } = _decorator;
//无人机
@ccclass('Drone')
export class Drone {

    curPos = v3();
    curRot = v3();
    node: Node = null;

    height = 0;

    transMsr: ModifyPosRotMesh = null;

    constructor(node) {
        this.node = node;
        this.transMsr = node.getComponent(ModifyPosRotMesh);
    }

    init() {
        //
        this.height = WeaponCfg[GlobalEnum.WeaponType.Drone].droneheight;
        this.curPos.set(GlobalTmpData.Player.wpos).add(GlobalTmpData.Player.offset);
        this.curRot.y = GlobalTmpData.Player.wrotY - 1.57;
        this.curPos.y = 15;
        this.initAtk();
    }

    reset() {
        Tools.clearObj(this);
    }

    setOffset() {

    }

    customUpdate(dt) {
        this.move(dt);
        this.updateAtk(dt);
    }


    //#region ------------移动--
    tmpP = v3();
    tmpP1 = v3();
    offsetX = 0; //水平偏移

    move(dt) {
        //叠加偏移
        this.tmpP1.set(this.offsetX, 0, 0);
        //
        Vec3.rotateY(this.tmpP1, this.tmpP1, Vec3.ZERO, GlobalTmpData.Player.wrotY - 1.57);
        this.tmpP.set(GlobalTmpData.Player.wpos); //.add(GlobalTmpData.Player.offset);
        this.tmpP.add(this.tmpP1);

        this.curPos.lerp(this.tmpP, 0.1 * dt * 60);
        this.curPos.y += (this.height - this.curPos.y) * 0.1 * dt * 60;

        this.curRot.y += (GlobalTmpData.Player.wrotY - 1.57 - this.curRot.y) * 0.2 * dt * 60;

        if (this.transMsr) {
            this.transMsr.setTransData(this.curPos, this.curRot, 2);
        }
    }
    //#endregion


    //#region ------------攻击--
    atkCd = 0;
    curt = 0;
    atk = 0;
    initAtk() {
        const cfg = WeaponCfg[GlobalEnum.WeaponType.Drone];
        this.atk = cfg.atk;
        this.atkCd = 1 / cfg.atkSpd;
        this.curt = 0;
    }

    updateAtk(dt) {
        if (!GlobalTmpData.Game.isGameRun) return;
        this.curt += dt;
        if (this.curt >= this.atkCd) {
            this.curt = 0;
            this.onAtk();
        }
    }
    tmpV = v3();
    atkData = { pos: v3(), rot: v3(), lineVec: v3(), rotSpd: v3(), atkRate: 1 };
    shotBulletRot = [-3, 0, 3];

    onAtk() {
        AudioSystem.playEffect(AudioEnum.Drone);
        const cfg = WeaponCfg[GlobalEnum.WeaponType.Drone];
        //发射子弹
        let rotY = this.curRot.y - 1.57;
        for (let i = 0; i < this.shotBulletRot.length; i++) {
            const r = this.shotBulletRot[i] * 0.01745;

            this.tmpV.set(1, 0, 0);
            Vec3.rotateY(this.tmpV, this.tmpV, Vec3.ZERO, r + rotY);
            this.tmpV.multiplyScalar(cfg.bulletSpd || 10);

            this.tmpP.set(this.curPos).add3f(0, 1, 0);

            this.atkData.pos.set(this.tmpP);
            this.atkData.lineVec.set(this.tmpV);
            this.atkData.rotSpd.set(Vec3.ZERO);
            this.atkData.atkRate = cfg.bulletSpd;
            EventManager.emit(EventTypes.EffectEvents.showMergeEffect, cfg.bullet, this.atkData);
        }
    }
    //#endregion

}

