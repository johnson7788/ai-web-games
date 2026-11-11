import { _decorator, Component, Node, Vec3, MeshRenderer } from 'cc';
const { ccclass, property } = _decorator;

/** 通过shader 计算位移旋转 */
@ccclass('ModifyPosRotMesh')
export class ModifyPosRotMesh extends Component {

    msr: MeshRenderer = null;

    transPos = [0, 0, 0, 0];
    _transPos = 'a_transPos';
    transRot = [0, 0, 0, 0];
    _transRot = 'a_transRot';

    onLoad() {
        this.msr = this.node.getComponent(MeshRenderer);
        //修改数据
        if (this.msr.mesh) {
            delete this.msr.mesh.struct.maxPosition;
            delete this.msr.mesh.struct.minPosition;
        }
        //关闭阴影
        this.msr.shadowCastingMode = 0;
    }
    setData() {

    }
    /**
     * 同步参数
     * @param p 位置
     * @param r 弧度
     * @param r 缩放
     */
    setTransData(p: Vec3, r: Vec3, s: number) {
        if (!this.msr) return;
        this.transPos[0] = p.x;
        this.transPos[1] = p.y;
        this.transPos[2] = p.z;
        this.transPos[3] = s;

        this.transRot[0] = r.x;
        this.transRot[1] = r.y;
        this.transRot[2] = r.z;
        this.msr.setInstancedAttribute(this._transPos, this.transPos);
        this.msr.setInstancedAttribute(this._transRot, this.transRot);
    }
}

