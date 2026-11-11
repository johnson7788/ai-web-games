import { _decorator, Component, Node, Enum, v3, Tween, tween } from 'cc';
import { GlobalConfig, TrapCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { ColliderGroup, CollisionManager } from '../../Common/VertCollison/CollisionManager';
import { BasicRole } from '../BasicRole';
import { BasicProp } from './BasicProp';
const { ccclass, property } = _decorator;
//圆形电锯
@ccclass('ElectricSaw')
export class ElectricSaw extends BasicProp {
    cldGroup = ColliderGroup.PlayerTrigger;
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.ElectricSaw;

    @property(Node)
    moveTarget: Node = null;
    @property(Node)
    line: Node = null;

    setData(data) {
        super.setData(data);
        this.setMove(data.d);
    }

    reset() {
        this.resetMove();
        super.reset();
    }

    customUpdate(dt) {
        super.customUpdate(dt);
        this.updateMove(dt);
    }

    show() {
        super.show();
        if (!this._isRuning && this._isMove) {
            this.moveAnim();
        }
    }
    hide() {
        super.hide();
        if (this._isRuning) {
            this.resetMove();
        }
    }

    //#region ---------移动--------
    _isMove = false;
    _isRuning = false;
    _offset = v3();
    setMove(d) {
        this._isRuning = false;
        this._isMove = d != undefined && (+d != 0);
        this.line.active = this._isMove;
    }

    resetMove() {
        this._isRuning = false;
        this._offset.set(0, 0, 0);
        this.pos.set(0, 0, 0);
        this.moveTarget && this.moveTarget.setPosition(this._offset);
        Tween.stopAllByTarget(this._offset);
    }

    tmpP = v3();
    updateMove(dt) {
        if (this._isMove && this.moveTarget) {
            this.moveTarget.setPosition(this._offset);
            //
            this.pos.set(this.moveTarget.worldPosition);
        }
        this.rotateAnim(dt);
    }
    moveAnim() {
        this._isRuning = true;
        Tween.stopAllByTarget(this._offset);
        let w = GlobalConfig.RoadWidth * 0.4;
        this._offset.set(-w, 0, 0);
        let t = 3;

        tween(this._offset).repeatForever(
            tween(this._offset).
                to(t, { x: w }, { easing: 'sineInOut' }).
                to(t, { x: -w }, { easing: 'sineInOut' }).
                start()
        ).start();
    }
    _rot = v3();
    rotateAnim(dt) {
        if (this.moveTarget) {
            this._rot.y += dt * 180;
            this.moveTarget.eulerAngles = this._rot;
        }
    }
    //#endregion

    //#region ---------碰撞--------------
    //碰撞检测
    checkCollistion() {
        if (this.collider) {
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

