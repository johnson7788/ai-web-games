import { _decorator, Component, Node, Enum, Tween, tween, v3, Vec3 } from 'cc';
import { TrapCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { AudioEnum } from '../../../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../../../Init/SystemAudio/AudioSystem';
import { ColliderGroup, CollisionManager } from '../../Common/VertCollison/CollisionManager';
import { BasicRole } from '../BasicRole';
import { BasicProp } from './BasicProp';
const { ccclass, property } = _decorator;

@ccclass('Hammer')
export class Hammer extends BasicProp {
    cldGroup = ColliderGroup.PlayerTrigger;
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.Spininess;

    @property(Node)
    moveTarget: Node = null;

    @property(Node)
    root: Node = null;

    setData(d) {
        super.setData(d);
        //设置左右位置 1-左 2-右
        let param = +d.d || 2;
        let r = v3(0, param == 2 ? 0 : 180, 0);
        this.root.eulerAngles = r;
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
    rotAnim: Vec3 = v3();
    isRuning = false;
    runAnim() {
        this.isRuning = true;
        Tween.stopAllByTarget(this.rotAnim);
        this.rotAnim.set(0, 0, 0);
        this.moveTarget.eulerAngles = this.rotAnim;

        tween(this.rotAnim).repeatForever(
            tween(this.rotAnim).to(0.4, { z: 90 }, { easing: 'backInOut' }).
                call(() => {
                    this.checkCollistion();
                    AudioSystem.playEffect(AudioEnum.Hammer);
                }).
                to(0.4, { z: 0 }, { easing: 'sineIn' })
        ).start();
    }
    resetAnim() {
        this.isRuning = false;
        Tween.stopAllByTarget(this.rotAnim);
    }
    updateAnim(dt) {
        if (this.moveTarget) {
            this.moveTarget.eulerAngles = this.rotAnim;
        }
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

