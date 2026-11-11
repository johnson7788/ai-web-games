import { _decorator, Component, Node, v3, Vec3, Size } from 'cc';
import { WeaponCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import EventManager from '../../../../Init/Managers/EventManager';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { BasicCollider } from '../../Common/VertCollison/BasicCollider';
import { ColliderGroup, CollisionManager, CollisionTools } from '../../Common/VertCollison/CollisionManager';
import { Enemy } from '../Enemy';
const { ccclass, property } = _decorator;

@ccclass('BasicBullet')
export class BasicBullet {
    //对应传递v4数组的下标起始范围
    _index = 0;
    weaponType = 0;
    //
    isFinish = true;

    //----计算的参数
    lineSpd = v3();
    rotSpd = v3();
    scaleSpd = 0;
    opacitySpd = 0;

    //----传递的数据--占2个v4()-
    pos = v3();
    rot = v3(); //角度
    scale = 0;
    opacity = 0;
    activeNum = 0; //0关 1开
    //
    curt = 0;
    animTime = 0;
    initRot = v3(); //模型默认朝向
    //
    atkRate = 1;

    constructor(index, weaponType: number, initRot: Vec3) {
        this._index = index;
        this.initRot.set(initRot);
        this.weaponType = weaponType;
        this.rot.set(0, - this.initRot.y, 0);
    }

    setActive(initPos: Vec3, lineVec: Vec3, rotSpd: Vec3, atkRate: number, animTime: number, size: Size, scale: number, isCircleCollider: boolean) {
        this.atkRate = atkRate;
        this.isFinish = false;
        //
        this.activeNum = 1;
        this.pos.set(initPos); //初始位置
        //计算朝向
        let ry = Math.atan2(-lineVec.z, lineVec.x) * 57.3 + this.initRot.y + 180;
        this.rot.set(0, ry, 0);      //初始旋转角度
        this.animTime = animTime;
        //
        this.scale = scale;
        this.opacity = 1;
        //
        this.lineSpd.set(lineVec);
        this.rotSpd.set(rotSpd);
        //
        this.setCollider(size, isCircleCollider);
    }

    init() {

    }

    reset() {
        this.isFinish = true;
        this.activeNum = 0;
        this.curt = 0;
        this.resetCollider();
    }

    tmpP = v3();
    tmpR = v3();

    update(dt) {
        this.move(dt);
        this.updateCollider(dt);
    }

    lateUpdate(dt) {
        this.lateUpdateCollider(dt);
    }

    //#region ------------位移--------------
    move(dt) {
        //位移
        this.tmpP.set(this.lineSpd).multiplyScalar(dt);
        this.pos.add(this.tmpP);
        //旋转
        // this.tmpR.set(this.rotSpd).multiplyScalar(dt);
        // this.rot.add(this.tmpR);

        this.curt += dt;
        if (this.curt >= this.animTime) {
            this.isFinish = true;
            this.reset();
        }
    }
    //#endregion

    //#region -------------碰撞体----------------
    collider: BasicCollider<BasicBullet> = null;

    setCollider(size: Size, isCircleCollider) {
        this.collider = new BasicCollider<BasicBullet>(ColliderGroup.PlayerBullet, this, true);

        this.collider.setRectSize(size);
        this.collider.setRectPos(this.pos);
        this.collider.updateGridInfo(true);
        this.collider.isCircleCollider = isCircleCollider;
    }

    resetCollider() {
        if (this.collider) {
            this.collider.clearGridInfo();
            this.collider.removeFromManager();
            this.collider = null;
        }
    }

    updateCollider(dt) {
        this.checkEnemys();
    }
    lateUpdateCollider(dt) {
        this.collider && this.collider.lateUpdate(dt);
    }

    //碰撞检测
    checkEnemys() {
        !this.isFinish && this.collider.checkPosFast(this.pos, this.onCheckColliderCb.bind(this));
    }

    //碰撞检测回调
    onCheckColliderCb(groupId: number, cldId: number) {
        if (!this.isFinish) {
            let target = CollisionManager.allColliderRecs[cldId];
            if (target && groupId == ColliderGroup.Enemy) {
                let enemy = target.targetCmp as Enemy;
                let atk = WeaponCfg[this.weaponType].atk * this.atkRate;
                enemy.byHit(atk);

                //击中效果
                switch (this.weaponType) {
                    case GlobalEnum.WeaponType.FireGun:
                        //爆炸效果
                        EventManager.emit(EventTypes.EffectEvents.show3DTo2DEffect, { t: GlobalEnum.Effect3dType.Effect_jz_fireball_boom, p: this.pos });
                        // this.tmpP.set(this.pos);
                        // this.tmpP.y += 0.5;
                        // EventManager.emit(EventTypes.EffectEvents.showObjs, GlobalEnum.Effect3dType.fireWork, { p: this.tmpP });


                        let n = Math.floor(Math.random() * 3) + 1;
                        for (let i = 0; i < n; i++) {
                            this.tmpP.set(this.pos);
                            this.tmpP.y += 0.5;
                            this.tmpP.x += (Math.random() * 2 - 1) * 2;
                            this.tmpP.z += (Math.random() * 2 - 1) * 2 + 2;
                            // EventManager.emit(EventTypes.EffectEvents.showMergeEffect, GlobalEnum.MergeEffectType.MergeFireEffect, this.tmpP);
                            EventManager.emit(EventTypes.EffectEvents.showObjs, GlobalEnum.Effect3dType.fireEffect, { p: this.tmpP });

                        }
                        break;

                    default:
                        break;
                }
                //test
                // EventManager.emit(EventTypes.EffectEvents.showFrameEffect, 'fireBoom', this.pos);

                this.isFinish = true;
                this.reset();

                return;
            }
        }
    }


    //#endregion
}

