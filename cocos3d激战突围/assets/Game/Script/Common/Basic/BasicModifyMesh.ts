import { _decorator, Component, Node, MeshRenderer, v3, Vec3, gfx, Mesh, utils } from 'cc';
const { ccclass, property } = _decorator;

/** 通过shader 计算位移旋转 */
@ccclass('BasicModifyMesh')
export class BasicModifyMesh extends Component {
    @property(MeshRenderer)
    msr: MeshRenderer = null;

    transData1 = [0, 0, 0, 0];//xz 坐标，y缩放 w旋转
    transData2 = [0, 0, 0, 0];//x:击中颜色深度
    a_transData1 = 'a_transData1';
    a_transData2 = 'a_transData2';
    _curColorNum = 0;
    _deathNum = 1;

    onLoad() {
        //修改数据
        delete this.msr.mesh.struct.maxPosition;
        delete this.msr.mesh.struct.minPosition;
        //关闭阴影
        this.msr.shadowCastingMode = 0;
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
        this.transData1[0] = p.x;
        this.transData1[1] = s;
        this.transData1[2] = p.z;
        this.transData1[3] = radianY;
        this.msr.setInstancedAttribute(this.a_transData1, this.transData1);
    }

    byHit() {
        this._curColorNum = 1;
    }

    setDeath() {
        //死亡颜色-黑色程度
        this._deathNum = 0.05;
    }
    @property
    isUseColor = true;

    updateColor(dt) {
        if (!this.isUseColor) return;
        this._curColorNum += (0 - this._curColorNum) * 0.2 * dt * 60;
        this.transData2[0] = this._curColorNum;
        this.transData2[1] = this._deathNum;

        this.msr.setInstancedAttribute(this.a_transData2, this.transData2);
    }
}

