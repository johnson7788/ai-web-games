import { _decorator, Component, Node, MeshRenderer, Vec3 } from 'cc';
import { BasicModifyMesh } from '../Common/Basic/BasicModifyMesh';
const { ccclass, property } = _decorator;

@ccclass('GiantModifyMesh')
export class GiantModifyMesh extends BasicModifyMesh {

    @property(MeshRenderer)
    msrA: MeshRenderer = null;
    @property(MeshRenderer)
    msrB: MeshRenderer = null;
    @property(MeshRenderer)
    msrC: MeshRenderer = null;

    transData1 = [0, 0, 0, 0];//xz 坐标，y缩放 w旋转
    transData2 = [0, 0, 0, 0];//x:击中颜色深度

    a_transData1 = 'a_transData1';
    a_transData2 = 'a_transData2';
    _curColorNum = 0;
    _deathNum = 1;

    msrArr: MeshRenderer[] = [];
    onLoad() {
        this.msrArr.push(this.msr, this.msrA, this.msrB, this.msrC);
        for (let i = 0; i < this.msrArr.length; i++) {
            const msr = this.msrArr[i];
            //修改数据
            delete msr.mesh.struct.maxPosition;
            delete msr.mesh.struct.minPosition;
            //关闭阴影
            msr.shadowCastingMode = 0;

        }
    }
    setData() {
        this._curColorNum = 0;
        this._deathNum = 1;
        this.transData2[0] = this._curColorNum;
        this.transData2[1] = this._deathNum;

    }
    /**
     * 同步参数
     * @param p 位置
     * @param radianY Y轴弧度
     * @param s 缩放
     */
    setTransData(p: Vec3, radianY: number, s: number) {
        // this.msrArr.setInstancedAttribute(this.a_transData1, this.transData1);
        this.transData1[0] = p.x;
        this.transData1[1] = s;
        this.transData1[2] = p.z;
        this.transData1[3] = radianY;

        for (let i = 0; i < this.msrArr.length; i++) {
            const msr = this.msrArr[i];
            msr.node.active && msr.setInstancedAttribute(this.a_transData1, this.transData1);
        }
    }

    byHit() {
        this._curColorNum = 1;
    }

    setDeath() {
        //死亡颜色-黑色程度
        this._deathNum = 0.05;
    }

    updateColor(dt) {
        this._curColorNum += (0 - this._curColorNum) * 0.2 * dt * 60;
        this.transData2[0] = this._curColorNum;
        this.transData2[1] = this._deathNum;

        for (let i = 0; i < this.msrArr.length; i++) {
            const msr = this.msrArr[i];
            msr.node.active && msr.setInstancedAttribute(this.a_transData2, this.transData2);
        }
    }
}

