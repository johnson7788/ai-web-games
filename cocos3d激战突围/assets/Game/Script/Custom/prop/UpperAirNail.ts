import { _decorator, Component, Node, Enum, v3, Vec3, Tween, tween } from 'cc';
import { TrapCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { BasicCollider } from '../../Common/VertCollison/BasicCollider';
import { ColliderGroup, CollisionManager, CollisionTools } from '../../Common/VertCollison/CollisionManager';
import { Enemy } from '../Enemy';
import { BasicProp } from './BasicProp';
const { ccclass, property } = _decorator;
//高空钉
@ccclass('UpperAirNail')
export class UpperAirNail extends BasicProp {
    cldGroup = ColliderGroup.PlayerTrigger;
    @property({ type: Enum(GlobalEnum.TrapType) })
    trapType: GlobalEnum.TrapType = GlobalEnum.TrapType.ElectricSaw;

    @property(Node)
    moveTargets: Node = null;

    @property(Node)
    pushBtn: Node = null;

    initSub() {
        this.initAnim();
    }

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

    //#region -------动画--------------
    initPosArr: Vec3[] = null;
    _isAnimFinish = false;
    _animRecs: { node: Node, p: Vec3, v: Vec3, delay: number }[] = null;
    _gravity = -10;
    _animTime = 0;

    initAnim() {
        this.pushBtn.setPosition(0, 0.2, 0);
        this.initPosArr = [];
        for (let i = 0; i < this.moveTargets.children.length; i++) {
            const e = this.moveTargets.children[i];
            this.initPosArr.push(v3(e.position))
        }
    }

    showAnim() {
        this.pushBtn.setPosition(0, 0, 0);
        this._isAnimFinish = false;
        this._animTime = 0;
        this._animRecs = [];
        for (let i = 0; i < this.moveTargets.children.length; i++) {
            const e = this.moveTargets.children[i];
            this._animRecs.push({ node: e, p: v3(this.initPosArr[i]), v: v3(0, -3, 0), delay: 0.1 });
        }
    }

    resetAnim() {
        for (let i = 0; i < this.initPosArr.length; i++) {
            const e = this.initPosArr[i];
            this.moveTargets.children[i].setPosition(e);
        }

        if (this._animRecs) {
            for (let i = 0; i < this._animRecs.length; i++) {
                const e = this._animRecs[i];
                e.node = null;
                e.p = null;
                e.v = null;
            }
        }
        this._animRecs = null;
        this.pushBtn.setPosition(0, 0.2, 0);
        this._animTime = 0;
    }
    tmpP = v3();

    updateAnim(dt) {
        if (this._animRecs) {
            this._animTime += dt;
            for (let i = this._animRecs.length - 1; i >= 0; i--) {
                const e = this._animRecs[i];

                if (this._animTime >= e.delay) {
                    e.v.y += this._gravity * dt;
                    this.tmpP.set(e.v).multiplyScalar(dt);
                    e.p.add(this.tmpP);
                    e.node.setPosition(e.p);
                    if (e.p.y <= 0.1) {
                        e.p.y = 0.1;
                        e.node.setPosition(e.p);
                        this.checkColByPos(e.node.worldPosition);
                        this._animRecs.splice(i, 1);
                    }
                }
            }
        }
    }

    //#endregion

    //#region ---------碰撞--------------
    setCollider() {
        this.pos.set(this.pushBtn.worldPosition);
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
        this.showAnim();
    }

    radius = 1.2;
    checkGroup = [ColliderGroup.Enemy];
    checkRes: { [groupId: number]: number[] };
    //检测指定位置
    checkColByPos(p) {
        this.checkRes = {};
        if (CollisionTools.getCollInfoByPos(p, this.radius, this.checkRes, this.checkGroup)) {
            const cfg = TrapCfg[this.trapType];
            let curLen = 0;
            let maxLen = this.radius * this.radius;

            for (const key in this.checkRes) {
                const arr = this.checkRes[key];
                for (let i = 0; i < arr.length; i++) {
                    const cld = arr[i];
                    const target = CollisionManager.getColilderByColId(cld).targetCmp as Enemy;
                    if (target) {
                        curLen = this.tmpP.set(p).subtract(target.curPos).lengthSqr();
                        if (curLen <= maxLen) {
                            //碰撞
                            target.byHit(cfg.atk);
                        }
                    }
                }
            }
        }
    }

    //#endregion

}

