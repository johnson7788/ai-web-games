import { _decorator, Component, Node, MeshRenderer, Vec3 } from 'cc';
import { GlobalConfig } from '../../../Init/Config/GlobalConfig';
import { StorageSystem } from '../../../Init/SystemStorage/StorageSystem';
import { BasicModifyMesh } from '../Common/Basic/BasicModifyMesh';
import { GiantModifyMesh } from './GiantModifyMesh';
import { Role } from './Role';
const { ccclass, property } = _decorator;

@ccclass('RoleGiant')
export class RoleGiant extends Role {
    shieldModifyCmp: BasicModifyMesh = null;
    modfiyMsCmp: GiantModifyMesh = null;

    init(node: Node, initPos: Vec3, offset: Vec3, pathLineVec, isGiant) {
        super.init(node, initPos, offset, pathLineVec, isGiant);
        this.shieldModifyCmp = this.node.getChildByName('shield').getComponent(BasicModifyMesh);
        this.shieldModifyCmp.setData();
    }

    //设置巨人等级
    setGiantLv(n) {
        if (!this.isGiant) return;
        this.curGiantLv = n;
        //设置巨人等级的表现
        this.modfiyMsCmp.msrC.node.active = true;
        //第二级-耳机
        this.modfiyMsCmp.msrB.node.active = false;
        if (this.curGiantLv == 2) {
            this.modfiyMsCmp.msrB.node.active = true;
        }
        //第三级-帽子+盾牌
        this.modfiyMsCmp.msrA.node.active = false;
        this.shieldModifyCmp.node.active = false;

        if (this.curGiantLv == 3) {
            this.modfiyMsCmp.msrA.node.active = true;
            this.shieldModifyCmp.node.active = true;
        }

        //属性
        let lv = StorageSystem.getData().levelAssets.curLv;
        let rate = Math.round(100 * lv / 10) / 100 + 1;
        const cfg = GlobalConfig.Player;
        this.hp = cfg.giantHp * rate;
        this.atkRate = cfg.giantAtkRate * rate;
    }

    updateTransData(dt: any): void {
        super.updateTransData(dt);
        //同步盾牌位置
        if (this.shieldModifyCmp && this.shieldModifyCmp.node.active) {
            this.tmpP.set(this.shieldModifyCmp.node.position).multiplyScalar(this.curScale);
            Vec3.rotateY(this.tmpP, this.tmpP, Vec3.ZERO, this._curRadianY);
            this.tmpP.add(this.curPos);
            this.shieldModifyCmp.setTransData(this.tmpP, this._curRadianY, this.curScale);
            this.shieldModifyCmp.updateColor(dt);
        }
    }
}

