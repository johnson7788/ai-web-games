import { _decorator, Component, Node, Enum, Vec3, v3, Tween, tween } from 'cc';
import { TrapCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { ColliderGroup, CollisionManager } from '../../Common/VertCollison/CollisionManager';
import { BasicRole } from '../BasicRole';
import { BasicProp } from './BasicProp';
const { ccclass, property } = _decorator;
//地刺
@ccclass('Spininess')
export class Spininess extends BasicProp {
    cldGroup = ColliderGroup.PlayerTrigger;
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.Spininess;

    @property(Node)
    moveTarget: Node = null;

    setData(d) {
        super.setData(d);

    }

    reset() {
        this.resetAnim();
        super.reset();
    }

    customUpdate(dt) {
        super.customUpdate(dt);
        this.updateAnim(dt);
    }

    show() {
        super.show();
        if (!this.isRuning) {
            this.runAnim();
        }
    }

    hide() {
        super.hide();
        if (this.isRuning) {
            this.resetAnim();
        }
    }

    //#region --------动画------
    posAnim: Vec3 = v3();
    isRuning = false;
    runAnim() {
        this.isRuning = true;
        Tween.stopAllByTarget(this.posAnim);
        this.posAnim.set(0, -1, 0);
        this.moveTarget.setPosition(this.posAnim);
        tween(this.posAnim).repeatForever(
            tween(this.posAnim).to(0.4, { y: 0 }, { easing: 'backOut' }).
                call(() => {
                    this.checkCollistion();
                }).
                to(0.4, { y: -1 }).delay(0.6)
        ).start();
    }
    resetAnim() {
        this.isRuning = false;
        Tween.stopAllByTarget(this.posAnim);
    }
    updateAnim(dt) {
        this.moveTarget && this.moveTarget.setPosition(this.posAnim);
    }
    //#endregion

    //#region --------------碰撞体---------------

    updateCollider(dt) {
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

