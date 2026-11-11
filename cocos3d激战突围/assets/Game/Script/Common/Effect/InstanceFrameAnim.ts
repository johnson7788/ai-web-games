import { _decorator, Component, Node, MeshRenderer, Vec2, v2, Vec3, v3, v4 } from 'cc';
import { EDITOR } from 'cc/env';
import { BasicComponet } from '../../../../Init/Basic/BasicComponet';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
// import { BasicEffect } from '../Basic/BasicEffect';
const { ccclass, property, executeInEditMode } = _decorator;

/**3D 面片 帧动画 */
@ccclass('InstanceFrameAnim')
@executeInEditMode
export class InstanceFrameAnim extends BasicComponet {

    msr: MeshRenderer = null;

    @property
    delayTime: number = 0;
    @property
    uvRange: Vec2 = v2();
    @property
    uvStepTime = 0.2;

    @property
    isLoop = false;
    @property
    scale: Vec3 = v3(1, 1, 1);

    curPos = v3();

    scaleRate = 1;
    // @property
    // testPos = v3(0, 0, 0);
    onEnable() {
        if (EDITOR) {
            this.setData({ p: v3(), s: 1 });//test
        }
    }

    setData(d: { p: Vec3, s: number }) {
        this.curPos.set(d.p);
        this.scaleRate = d.s || 1;
        this.msr = this.node.getComponent(MeshRenderer);
        // this.node.setPosition(Vec3.ZERO);

        this.node.setPosition(this.curPos);
        this.node.eulerAngles = Vec3.ZERO;

        this.setUv();
        this.setMat();
    }


    reset() {

    }

    update(dt) {
        this.updateUv(dt);
        this.updateMat(dt);
    }

    //#region -----------uv切换-------
    //动态UV
    curUvOffset = v2();

    curUvTime = 0;
    curFrameIndex = 1;
    curUvXCount = 0;    //当前水平切换行数
    maxFrame = 1;
    uvOffsetStep = v2();
    isFinish = false;

    curt = 0;
    setUv() {
        this.curt = 0;
        this.isFinish = false;
        this.maxFrame = this.uvRange.x * this.uvRange.y;
        this.uvOffsetStep.set(1 / this.uvRange.x, 1 / this.uvRange.y);

        this.curUvOffset.set(0, 0);
        this.curUvXCount = 0;
        this.curFrameIndex = 1;
        this.curUvTime = 0;
    }
    updateUv(dt) {
        //uv切换-先水平切换 再垂直切换
        if (this.curFrameIndex < this.maxFrame ||
            this.curFrameIndex >= this.maxFrame && this.isLoop) {

            this.curUvTime += dt;
            if (this.curUvTime >= this.uvStepTime) {
                this.curUvTime = 0;
                this.curFrameIndex++;

                this.curUvOffset.x += this.uvOffsetStep.x;
                if (this.curUvOffset.x >= 1) {
                    this.curUvOffset.x = 0;
                    this.curUvXCount++;
                }
                this.curUvOffset.y = this.uvOffsetStep.y * this.curUvXCount;
                if (this.curUvOffset.y >= 1) {
                    this.curUvOffset.y = 0;
                    this.curUvXCount = 0;
                }
            }
        }

        this.curt += dt;
        if (this.curt >= this.delayTime) {
            this.curt = 0;
            this.isFinish = true;
            if (!EDITOR) {
                GlobalPool.put(this.node);
            }
        }
    }

    //#endregion

    //#region ----------材质------------
    //xyz 位置 w整体缩放
    _transData1 = [0, 0, 0, 1];
    _data1 = 'transData1';
    //xy uv缩放 zw uv偏移;
    _transData2 = [0, 0, 0, 0];
    _data2 = 'transData2';
    //xyz 顶点比例缩放
    _transData3 = [0, 0, 0, 0];
    _data3 = 'transData3';

    setMat() {
        this._transData1[0] = this.curPos.x;
        this._transData1[1] = this.curPos.y;
        this._transData1[2] = this.curPos.z;
        this._transData1[3] = this.scaleRate;

        this._transData2[0] = this.uvOffsetStep.x;
        this._transData2[1] = this.uvOffsetStep.y;
        this._transData2[2] = 0;
        this._transData2[3] = 0;

        this._transData3[0] = this.scale.x;
        this._transData3[1] = this.scale.y;
        this._transData3[2] = this.scale.z;

        this.msr && this.msr.setInstancedAttribute(this._data1, this._transData1);
        this.msr && this.msr.setInstancedAttribute(this._data3, this._transData3);
    }

    updateMat(dt) {
        if (!this.msr) return;
        // this._transData1[0] = this.curPos.x;
        // this._transData1[1] = this.curPos.y;
        // this._transData1[2] = this.curPos.z;
        // this.msr.setInstancedAttribute(this._data1, this._transData1);

        this._transData2[2] = this.curUvOffset.x;
        this._transData2[3] = this.curUvOffset.y;

        this.msr.setInstancedAttribute(this._data2, this._transData2);
    }

    //#endregion

}

