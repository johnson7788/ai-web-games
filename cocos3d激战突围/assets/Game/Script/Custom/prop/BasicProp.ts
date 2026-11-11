import { _decorator, Component, Node, Size, size, Vec3, Enum, v3, Quat } from 'cc';
import { BasicComponet } from '../../../../Init/Basic/BasicComponet';
import { BasicCollider } from '../../Common/VertCollison/BasicCollider';
import { ColliderGroup } from '../../Common/VertCollison/CollisionManager';
const { ccclass, property } = _decorator;

@ccclass('BasicProp')
export class BasicProp extends BasicComponet {
    @property
    cldSize: Size = size(1, 1);
    @property
    isCircleCollider = false;
    //#region ---------------生命周期-----------
    //d: 额外参数
    setData(data?: { p: Vec3, r: Quat, d: any, parent?}) {
        this.node.setPosition(data.p);
        this.node.setRotation(data.r);
        this.node.parent = data.parent;
        this.setCollider();
    }

    reset() {
        this.resetCollider();
    }

    show() {

    }
    hide() {

    }

    customUpdate(dt) {
        this.updateCollider(dt);
    }

    customLateUpdate(dt) {
        this.lateUpdateCollider(dt);
    }
    //#endregion


    //#region --------------碰撞体---------------
    collider: BasicCollider<BasicProp> = null;
    cldGroup = ColliderGroup.Trap; //默认
    pos = v3();
    setCollider() {
        this.pos.set(this.node.worldPosition);  //默认
        this.collider = new BasicCollider<BasicProp>(this.cldGroup, this, true);
        this.collider.setRectSize(this.cldSize);
        this.collider.setRectPos(this.pos);
        this.collider.updateGridInfo(true);
        this.collider.isCircleCollider = this.isCircleCollider;
    }

    resetCollider() {
        if (this.collider) {
            this.collider.clearGridInfo();
            this.collider.removeFromManager();
            this.collider = null;
        }
    }

    updateCollider(dt) {
        this.checkCollistion();
    }
    //碰撞检测
    checkCollistion() {
        if (this.collider) {
            this.collider.checkPosCollistion(this.pos, this.onCheckColliderCb.bind(this));
        }
    }
    //碰撞回调
    onCheckColliderCb(out: { [groupId: number]: number[] }) {

    }

    lateUpdateCollider(dt) {
        this.collider && this.collider.lateUpdate(dt);
    }

    //#endregion
}

