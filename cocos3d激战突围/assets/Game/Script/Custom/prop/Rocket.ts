import { _decorator, Component, Node, Enum, v3, v2, Vec2, Size, size } from 'cc';
import { TrapCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { AudioEnum } from '../../../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../../../Init/SystemAudio/AudioSystem';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import { CollisionManager } from '../../Common/VertCollison/CollisionManager';
import { BasicRole } from '../BasicRole';
import { BasicProp } from './BasicProp';
const { ccclass, property } = _decorator;

@ccclass('Rocket')
export class Rocket extends BasicProp {
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.Spininess;
    @property(Node)
    rocket: Node = null;

    //#region ---------------生命周期-----------
    initSub() {
        this.initAnim();
    }
    setData(data) {
        super.setData(data);
    }

    reset() {
        this.resetAnim();
        this.resetCollider();
    }

    customUpdate(dt) {
        this.updateCollider(dt);
        this.updateAnim(dt);
    }

    customLateUpdate(dt) {
        this.lateUpdateCollider(dt);
    }
    //#endregion

    //#region --------------导弹动画---------------
    initRoketPos = v3();
    _roketPos = v3();
    _lineVec = v3();
    _isRun = false;
    _g = -10;

    initAnim() {
        this.rocket.active = false;
        this.initRoketPos.set(0, 10, 0);
    }

    showAnim() {
        this.rocket.active = true;
        this._lineVec.set(0, -10, 0);
        this._roketPos.set(this.initRoketPos);
        this.rocket.setPosition(this._roketPos);
        this._isRun = true;
    }

    resetAnim() {
        this.rocket.active = false;
        this._isRun = false;
        this.rocket.setPosition(this.initRoketPos);
    }

    tmpP = v3();
    smookData = { p: v3() };
    updateAnim(dt) {
        if (this._isRun) {
            this._lineVec.y += this._g * dt;
            this.tmpP.set(this._lineVec).multiplyScalar(dt);
            this._roketPos.add(this.tmpP);
            this.rocket.setPosition(this._roketPos);
            //烟雾
            this.smookData.p.set(this.rocket.children[0].worldPosition);
            this.emit(EventTypes.EffectEvents.showMergeEffect, GlobalEnum.MergeEffectType.MergeRocketSmook, this.smookData);

            if (this._roketPos.y < 0) {
                this._isRun = false;

                //爆炸效果
                this.emit(EventTypes.EffectEvents.show3DTo2DEffect, { t: GlobalEnum.Effect3dType.Effect_jz_rocketboom, p: this.pos });

                this.checkCollistion();

                AudioSystem.playEffect(AudioEnum.boom);
                //回收
                GlobalPool.put(this.node);
            }
        }
    }

    //#region 

    //#region --------------碰撞体---------------
    @property
    boomSize: Size = size();

    isTriggerUsed = false;

    resetCollider() {
        this.isTriggerUsed = false;
        super.resetCollider();
    }
    //触发器检测
    checkTrigger() {
        if (!this.isTriggerUsed) {
            this.collider && this.collider.checkPosFast(this.pos, this.onTriggerEnter.bind(this));
        }
    }
    //爆炸检测
    checkCollistion() {
        if (this.collider) {
            this.collider.setRectSize(this.boomSize);
            this.collider.checkPosCollistion(this.pos, this.onCheckColliderCb.bind(this));
        }
    }

    updateCollider(dt) {
        this.checkTrigger();
    }

    onTriggerEnter() {
        //爆炸-销毁
        this.isTriggerUsed = true;
        this.showAnim();
    }


    //碰撞回调
    onCheckColliderCb(out: { [groupId: number]: number[] }) {
        const cfg = TrapCfg[this.trapType];

        for (const key in out) {
            const cldArr = out[key];
            for (let i = 0; i < cldArr.length; i++) {
                const cld = cldArr[i];
                const target = CollisionManager.getColilderByColId(cld).targetCmp;
                if (target) {
                    const role = target as BasicRole;
                    role.byHit(cfg.atk);
                }
            }

        }
    }
    //#endregion
}

