import { _decorator, Component, Node, Enum, SkeletalAnimation, v3, Vec3, Tween, tween } from 'cc';
import { TrapCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { BasicCollider } from '../../Common/VertCollison/BasicCollider';
import { ColliderGroup } from '../../Common/VertCollison/CollisionManager';
import { BasicProp } from './BasicProp';
const { ccclass, property } = _decorator;
//炮台
@ccclass('FortBarbette')
export class FortBarbette extends BasicProp {
    cldGroup = ColliderGroup.PlayerTrigger;
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.FortBarbette;

    @property(Node)
    skeleNode: Node = null;

    anim: FortBarbetteAnim = null;
    _isPlaying = false;

    initSub() {
        this.anim = new FortBarbetteAnim(this.skeleNode);
        this.anim.init(this);
    }

    setData(d) {
        this.anim.setData();
        super.setData(d);
    }

    reset() {
        this.anim.reset();
        this._isPlaying = false;
        super.reset();
    }

    customUpdate(dt) {
        super.customUpdate(dt);
        this.anim.update(dt);
    }

    show() {
        if (this.isTriggerUsed && !this._isPlaying) {
            this._isPlaying = true;
            this.anim.showAtkAnim();
        }
    }

    hide() {
        if (this.isTriggerUsed && this._isPlaying) {
            this._isPlaying = false;
            this.anim.stopAnim();
        }
    }

    //#region ---------碰撞--------------

    setCollider() {
        this.pos.set(this.node.worldPosition);
        this.collider = new BasicCollider<BasicProp>(this.cldGroup, this, true);
        this.collider.setRectSize(this.cldSize);
        this.collider.setRectPos(this.pos);
        this.collider.updateGridInfo(true);
        this.collider.isCircleCollider = this.isCircleCollider;
    }

    isTriggerUsed = false;
    resetCollider() {
        super.resetCollider();
        this.isTriggerUsed = false;
    }

    checkCollistion() {
        //触发器
        if (!this.isTriggerUsed) {
            this.collider && this.collider.checkPosFast(this.pos, this.onTriggerEnter.bind(this));
        }
    }

    onTriggerEnter() {
        this.isTriggerUsed = true;
        this.anim.showStartAnim(() => {
            this._isPlaying = true;
            this.anim && this.anim.showAtkAnim();
        })
    }

    tmpV = v3();
    tmpP = v3();
    atkData = { pos: v3(), rot: v3(), lineVec: v3(), rotSpd: v3(), atkRate: 1 };
    onAtk() {
        const cfg = TrapCfg[this.trapType];
        //发射子弹
        let r = this.node.eulerAngles.y + 1.57;
        this.tmpV.set(1, 0, 0);
        Vec3.rotateY(this.tmpV, this.tmpV, Vec3.ZERO, r);
        this.tmpV.multiplyScalar(cfg.bulletSpd || 10);

        this.tmpP.set(this.node.worldPosition).add3f(0, 1, 0);

        this.atkData.pos.set(this.tmpP);
        this.atkData.lineVec.set(this.tmpV);
        this.atkData.rotSpd.set(Vec3.ZERO);
        this.atkData.atkRate = cfg.atkRate || 1;
        this.emit(EventTypes.EffectEvents.showMergeEffect, cfg.bulletType, this.atkData);
    }

    // #endregion
}


export class FortBarbetteAnim {
    cmp: FortBarbette = null;

    body: Node = null;
    head: Node = null;

    constructor(node) {
        this.body = node;
        this.head = node.getChildByName('head');
    }

    onEvents(): void {

    }

    offEvents(): void {
    }

    init(cmp: FortBarbette): void {
        this.cmp = cmp;
    }

    setData() {
        this.setAnim();
    }

    reset() {
        this.stopAnim();
    }

    update(dt) {
        this.updateAnim(dt);
    }


    //#region -----------动画-------------
    bodyPos = v3();
    headPos = v3();
    initBodyPos = v3(0, -2, 0);
    initHeadPos = v3(0, 0.42, 0);
    _isAtk = false;

    setAnim() {
        this.head.setPosition(this.initHeadPos);
        this.body.setPosition(this.initBodyPos);
        this._isAtk = false;
    }
    //升起动画
    showStartAnim(cb) {
        Tween.stopAllByTarget(this.bodyPos);
        this.bodyPos.set(this.initBodyPos);
        this.body.setPosition(this.bodyPos);

        tween(this.bodyPos).to(0.1, { y: 0 }, {
            onUpdate: () => {
                this.body && this.body.setPosition(this.bodyPos);
            }
        }).call(() => {
            cb && cb();
        }).start();
    }
    //攻击动画
    showAtkAnim() {
        this._isAtk = true;
        Tween.stopAllByTarget(this.headPos);
        this.headPos.set(this.initHeadPos);
        this.head.setPosition(this.headPos);
        let atkSpd = 0.2;

        tween(this.headPos).repeatForever(
            tween(this.headPos).
                to(atkSpd / 2, { z: -0.13 }).
                to(atkSpd / 2, { z: 0 }).
                call(() => {
                    this.onAtk();
                })
        ).start();
    }

    updateAnim(dt) {
        if (this._isAtk) {
            this.head.setPosition(this.headPos);
        }
    }

    resetAnim() {
        this.stopAnim();
    }

    stopAnim() {
        this._isAtk = false;
        Tween.stopAllByTarget(this.bodyPos);
        Tween.stopAllByTarget(this.headPos);
    }

    //攻击帧事件
    onAtk() {
        this.cmp && this.cmp.onAtk();
    }
    //#endregion
}