import { _decorator, Component, Node, Quat, Size, size, v3, Vec3, Enum } from 'cc';
import { TrapCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import EventManager from '../../../../Init/Managers/EventManager';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { AudioEnum } from '../../../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../../../Init/SystemAudio/AudioSystem';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import { BasicCollider } from '../../Common/VertCollison/BasicCollider';
import { ColliderGroup, CollisionManager } from '../../Common/VertCollison/CollisionManager';
import { BasicRole } from '../BasicRole';
import { BasicProp } from './BasicProp';
const { ccclass, property } = _decorator;

@ccclass('LandMine')
export class LandMine extends BasicProp {
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.Spininess;

    //#region ---------------生命周期-----------
    setData(data) {
        super.setData(data);
    }

    reset() {
        this.resetCollider();
    }

    customUpdate(dt) {
        this.updateCollider(dt);
    }

    customLateUpdate(dt) {
        this.lateUpdateCollider(dt);
    }
    //#endregion

    //#region --------------碰撞体---------------
    cldGroup = ColliderGroup.PlayerTrigger;
    @property
    boomSize: Size = size();

    isTriggerUsed = false;

    resetCollider() {
        this.isTriggerUsed = false;
        super.resetCollider();
    }

    checkCollistion() {
        if (!this.isTriggerUsed) {
            this.collider && this.collider.checkPosFast(this.pos, this.onTriggerEnter.bind(this));
        }
    }

    updateCollider(dt) {
        this.checkCollistion();
        if (this.isTriggerUsed) {
            //回收
            GlobalPool.put(this.node);
        }
    }

    onTriggerEnter() {
        //爆炸-销毁
        this.isTriggerUsed = true;
        //爆炸效果
        EventManager.emit(EventTypes.EffectEvents.show3DTo2DEffect, { t: GlobalEnum.Effect3dType.Effect_jz_mine_boom, p: this.pos });

        AudioSystem.playEffect(AudioEnum.boom);
        //检测
        if (this.collider) {
            this.collider.setRectSize(this.boomSize);
            this.collider.checkPosCollistion(this.pos, this.onCheckColliderCb.bind(this));
        }
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

