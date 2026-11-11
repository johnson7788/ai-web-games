
import { _decorator, Component, Node, Vec3, MeshRenderer, Material, renderer, Vec4, v4, director } from 'cc';
import { BasicComponet } from '../../../../Init/Basic/BasicComponet';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('FrameAnim')
export class FrameAnim extends BasicComponet {

    protected initSub() {
        this.initMat();
    }

    protected setData(data: { p: Vec3, e?: Vec3, s?: Vec3 }) {
        this.node.setPosition(data.p);
        if (!!data.e) {
            this.node.eulerAngles = data.e;
        }
        if (!!data.s) {
            this.node.setScale(data.s);
        }
        if (!!this.pass) {
            this.playData.w = director.root.cumulativeTime;
            this.applyMat();
            if (this.playData.x > 0) {
                let t = this.playData.x * this.frameData.w / this.frameData.z;
                this.scheduleOnce(this.onPlayFinish, t + 0.1);
            }
        }
    }
    protected onPlayFinish() {
        GlobalPool.put(this.node);
    }

    @property(MeshRenderer)
    protected mesh: MeshRenderer = null;
    protected pass: renderer.Pass = null;
    protected handleFrameData: number;
    protected frameData: Vec4;
    protected handlePlayData: number;
    protected playData: Vec4;
    protected initMat() {
        this.frameData = v4();
        this.playData = v4();
        let mat = this.mesh.getMaterial(0);
        let pass = mat.passes[0];
        let handlePlayData = pass.getHandle("playData");
        pass.getUniform(handlePlayData, this.playData);
        if (this.playData.y == 1) {
            return;
        }
        mat = this.mesh.getMaterialInstance(0);
        this.pass = mat.passes[0];
        this.handlePlayData = this.pass.getHandle("playData");
        this.pass.getUniform(this.handlePlayData, this.playData);
        this.handleFrameData = this.pass.getHandle("frameData");
        this.pass.getUniform(this.handleFrameData, this.frameData);
    }
    protected applyMat() {
        if (!!this.pass) {
            this.pass.setUniform(this.handleFrameData, this.frameData);
            this.pass.setUniform(this.handlePlayData, this.playData);
        }
    }
}


