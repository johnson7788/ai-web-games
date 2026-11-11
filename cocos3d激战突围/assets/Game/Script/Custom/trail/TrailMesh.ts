import { _decorator, Component, Node, MeshRenderer, Vec3, clamp01, gfx, utils, v3, renderer, Vec4, color, v4, v2, log, warn } from 'cc';
import { BasicComponet } from '../../../../Init/Basic/BasicComponet';
import Tools from '../../../../Init/Tools/Tools';
import { TrailRec } from './TrailRec';
const { ccclass, property, executeInEditMode } = _decorator;

//拖尾
@ccclass('TrailMesh')
// @executeInEditMode
export class TrailMesh extends BasicComponet {
    public static MAX_PARAM_LEN = 210; //参数长度限制
    //合并数量
    private mergeNum = 20;
    //单个拖尾的节点数量
    private trailLen = 3;

    @property(MeshRenderer)
    protected msr: MeshRenderer = null;

    protected meshData: { positions: number[], normals: number[], minPos?: Vec3, maxPos?: Vec3, colors?: number[], uvs: number[], indices: number[], customAttributes?: any[] } = null;
    public trailRecs: { [id: number]: TrailRec } = {};
    public isFull = false;
    private useCount = 0;
    //#region --生命周期
    onEnable(): void {
        //test
        // this.mergeNum = 1;
        // this.initMats();
        // this.setData({ mergeNum: 1, trailLen: 5, scale: 3 });
        // warn(Object.keys(this.trailRecs).length) 
    }

    protected initSub(): void {
        this.initMats();
    }
    protected onEvents(): void {

    }
    protected resetSub(): void {
        this.trailRecs = {};
        this.useCount = 0;
        this.isFull = false;
        this.resetTrailRecs();
        this.resetMat();
    }

    protected setData(data: { mergeNum: number, trailLen: number, scale: number }): void {
        this.mergeNum = data.mergeNum;
        this.trailLen = data.trailLen;
        this.scale = data.scale;
        this.createMesh();
    }

    public customUpdate(dt: number): void {
        this.updateTrail(dt);
        this.updateMat(dt);
    }

    //#endregion

    //#region --拖尾数据
    protected resetTrailRecs() {
        for (const key in this.trailRecs) {
            const rec = this.trailRecs[key];
            rec.reset();
        }
    }
    private updateTrail(dt) {
        for (const key in this.trailRecs) {
            const rec = this.trailRecs[key];
            if (rec.isUsed) {
                rec.update(dt);
                //同步显示
                for (let i = 0; i < rec.posLen; i++) {
                    const p = rec.posArr[i];
                    const _id = i + rec.trailId * rec.posLen;
                    //参数
                    this.setTrailAllParams(_id, p.x, 1, p.z, rec.rotArr[i].x);
                }
            }
        }
    }
    //显示拖尾
    public showTrail(followPos: Vec3, colorType: number, spd) {
        let _rec: TrailRec = null;
        for (const key in this.trailRecs) {
            const rec = this.trailRecs[key];
            if (!rec.isUsed) {
                _rec = rec;
                break;
            }
        }
        _rec.setActive(colorType, followPos, spd);

        this.useCount++;
        if (this.useCount >= this.mergeNum) {
            this.isFull = true;
        }
    }

    public onUnuseTrail(rec: TrailRec) {
        this.useCount--;
        this.isFull = false;
        //同步显示
        for (let i = 0; i < rec.posLen; i++) {
            const p = rec.posArr[i];
            const _id = i + rec.trailId * rec.posLen;
            //参数
            this.setTrailAllParams(_id, p.x, 0, p.z, rec.rotArr[i].x);
        }
    }

    //#endregion

    //#region --创建Mesh
    protected createMesh() {
        this.meshData = {
            positions: [],
            normals: [],
            uvs: [],
            indices: [],
            // minPos: v3(-cw, 0, ch),
            // maxPos: v3(cw, 0, -ch),
            customAttributes: [
                {
                    //v4 x 表示索引,  y:高度
                    attr: {
                        name: "a_animData",
                        format: gfx.Format.RGBA32F,
                        isNormalized: false,
                        stream: 0,
                        isInstanced: false,
                        location: 0,
                        //记录属性的偏移量
                        customOffset: 0,
                    },
                    values: [],
                },
            ],
        };

        let p = v3();
        let wp = this.node.worldPosition;
        //xz平面        
        let quadeIndex = 0;
        for (let i = 0; i < this.mergeNum; i++) {
            quadeIndex = i * (this.trailLen + 1);
            this.createMeshData(quadeIndex, this.meshData, wp, this.trailLen);
            //创建拖尾记录
            let rec = new TrailRec(i, this.trailLen, this);
            this.trailRecs[i] = rec;
        }

        setTimeout(() => {
            this.msr.mesh = utils.createMesh(this.meshData);
        }, 0);
    }

    //单个平面大小
    private bs = v3(1, 1, 1);
    private scale = 1;
    //创建平面
    protected createMeshData(quadeIndex, meshData, pos, quatNum) {
        //宽 高 长 的一半
        let cw = this.bs.x * 0.5 * this.scale;
        // let cl = this.bs.z * 0.5 * this.scale;
        let cl = 0;
        //中心点
        let x = pos.x;
        let y = pos.y;
        let z = pos.z;
        //面的数量
        const uvStepY = 1 / quatNum;

        for (let i = 0; i < quatNum; i++) {
            //初始顶点数量
            let vt = meshData.positions.length / 3;
            //顺时针 左上角开始 向+z轴延申
            /**
             * 0--1
             * |  |
             * 3--2
             */
            const _z = cl * 2 * i + z;
            meshData.positions.push(
                x - cw, y, _z - cl,
                x + cw, y, _z - cl,
                x + cw, y, _z + cl,
                x - cw, y, _z + cl,
            )
            //normals
            meshData.normals.push(
                0, 1, 0, 0, 1, 0,
                0, 1, 0, 0, 1, 0,
            )
            //uv
            meshData.uvs.push(
                0, uvStepY * i,
                1, uvStepY * i,
                1, uvStepY * (i + 1),
                0, uvStepY * (i + 1),
            )
            //index --三角面顺序 逆时针
            meshData.indices.push(
                vt + 0, vt + 3, vt + 2,
                vt + 2, vt + 1, vt + 0,
            )

            //x 表示参数v4的索引 y 固定高度
            const _index = quadeIndex + i;
            const _y = 0.5;
            meshData.customAttributes[0].values.push(
                _index, _y, 0, 0,
                _index, _y, 0, 0,
                _index + 1, _y, 0, 0,
                _index + 1, _y, 0, 0,
            )
        }

    }
    //#endregion

    //#region --材质参数
    private pass: renderer.Pass = null;
    //位置缩放xz 位置,y:缩放, w: Y轴旋转角度
    private uniformTrans: Vec4[];
    private handleTrans = 0;
    private transDirty = false;
    //旋转-四元数
    private handleRotate = 0;
    private uniformRotate: Vec4[];
    private rotateDirty = false;

    protected initMats() {
        let mat = this.msr.getMaterialInstance(0);
        this.pass = mat.passes[0];

        this.handleTrans = this.pass.getHandle('transData');
        // this.handleRotate = this.pass.getHandle('rotationData');

        this.uniformTrans = [];
        this.uniformRotate = [];
        let len = TrailMesh.MAX_PARAM_LEN; //和effect参数设定长度一致

        for (let n = 0; n < len; n++) {
            this.uniformTrans.push(v4(0, 0, 0, 0));
        }
        this.transDirty = true;
        this.applyTrans();
        this.rotateDirty = true;
        this.applyRotate();
    }

    public resetMat(): void {
        for (let n = 0; n < this.uniformTrans.length; n++) {
            this.uniformTrans[n].set(0, 0, 0, 0);
        }
        this.transDirty = true;
        this.applyTrans();
        this.rotateDirty = true;
        this.applyRotate();
    }

    private updateMat(dt) {
        this.applyTrans();
    }

    public setTrailAllParams(id: number, x, y, z, w) {
        if (this.uniformTrans[id] &&
            (this.uniformTrans[id].x != x || this.uniformTrans[id].y != y ||
                this.uniformTrans[id].z != z || this.uniformTrans[id].w != w)) {
            this.uniformTrans[id].x = x;
            this.uniformTrans[id].y = y;
            this.uniformTrans[id].z = z;
            this.uniformTrans[id].w = w;
            this.transDirty = true;
        }
    }

    public setTrailPos(id: number, x, z) {
        if (this.uniformTrans[id] &&
            (this.uniformTrans[id].x != x || this.uniformTrans[id].z != z)) {
            this.uniformTrans[id].x = x;
            this.uniformTrans[id].z = z;
            this.transDirty = true;
        }
    }
    public setTrailScale(id: number, s: number) {
        if (this.uniformTrans[id] &&
            (this.uniformTrans[id].w != s)) {
            this.uniformTrans[id].w = s;
            this.transDirty = true;
        }
    }
    public setTrailColor(id: number, c: number) {
        if (this.uniformTrans[id] &&
            (this.uniformTrans[id].y != c)) {
            this.uniformTrans[id].y = c;
            this.transDirty = true;
        }
    }

    public setTrailRotate(id, rt: number) {
        if (this.uniformTrans[id] &&
            this.uniformTrans[id].w != rt) {
            this.uniformTrans[id].w = rt;
            this.rotateDirty = true;
        }
    }

    public applyTrans() {
        if (this.transDirty) {
            this.pass && this.pass.setUniformArray(this.handleTrans, this.uniformTrans);
            this.transDirty = false;
        }
    }
    public applyRotate() {
        // if (this.rotateDirty) {
        //     this.pass && this.pass.setUniformArray(this.handleRotate, this.uniformRotate);
        //     this.rotateDirty = false;
        // }
    }
    //#endregion
}