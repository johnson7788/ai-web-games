import { _decorator, Component, Node, MeshRenderer, Mesh, CCInteger, v3, renderer, Vec4, v4, Vec3, utils, Vec2, Enum } from 'cc';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { MergeBasic } from './MergeBasic';
import { MergeGroup, PhyInitParam } from './MergeGroup';
import { MergeMesh } from './MergeMesh';
const { ccclass, property } = _decorator;
/**
 * 提前合并好指定数量的mesh
 * 再根据需要显示部分mesh
 */
@ccclass('MergeEffect')
export class MergeEffect extends MergeBasic {
    //每一种类型对应一种  meshData
    @property({ type: Enum(GlobalEnum.MergeType) })
    mergeType: GlobalEnum.MergeType = 0;

    meshRenderer: MeshRenderer = null;
    //单个MergeEffect最大合并数量
    static meshRecs: { [type: number]: MergeMesh } = {};
    private max = 110; //220 / 2

    /**需要合并的mesh */
    @property({ type: Mesh, displayName: '合并模型', group: '合并参数' })
    mergeMesh: Mesh = null;
    /**按照合并数量 / 单组数量 = 组数*/
    @property({ type: CCInteger, displayName: '单组数量', step: 1, min: 1, max: 110, group: '合并参数' })
    groupNum: number = 1;

    @property({ type: CCInteger, displayName: '动画时长', step: 0.1, group: '合并参数' })
    animTime = 2;

    @property({ type: Vec2, displayName: '初始UV偏移' })
    uvArr: Vec2[] = [];

    //#region ---------动画参数
    @property({ group: '物理参数' })
    lineSpd: Vec3 = v3();
    @property({ group: '物理参数' })
    lineFloat: Vec3 = v3();
    @property({ group: '物理参数' })
    lineDamping: Vec3 = v3();

    @property({ group: '物理参数', displayName: '角速度' })
    rotSpd: Vec3 = v3();
    @property({ group: '物理参数', displayName: '角度浮动' })
    rotFloat: Vec3 = v3();
    @property({ group: '物理参数', displayName: '角度衰减' })
    rotDamping: Vec3 = v3();

    @property({ group: '物理参数' })
    initScale = 1;
    @property({ group: '物理参数' })
    scaleFloat = 0;
    @property({ group: '物理参数' })
    scaleSpd = 0;
    //

    @property({ group: '透明参数' })
    opacity = 1;
    @property({ group: '透明参数' })
    opacitySpd = 0;

    //#endregion

    // #region ---------流程--------------

    initSub() {
        this.meshRenderer = this.node.getComponent(MeshRenderer);
        //同类型的mesh 共享 meshData;
        if (!MergeEffect.meshRecs[this.mergeType]) {
            MergeEffect.meshRecs[this.mergeType] = new MergeMesh();
            MergeEffect.meshRecs[this.mergeType].init(this.mergeMesh, this.max, this.uvArr);
            console.log('init:', this.node.name);
        }
        this.meshRenderer.mesh = utils.createMesh(MergeEffect.meshRecs[this.mergeType].meshData);
        this.initMats();
        this.initPhyParams();
        this.initEffects();
    }

    onEvents() {

    }

    setData(d) {
        this.setMat();
        this.setEffects();
    }

    reset() {
        this.resetMat();
        this.resetEffects();
        this.resetParams();
    }

    customUpdate(dt) {
        this.updateEffects(dt);
        this.updateMats(dt);
    }

    // #endregion

    //#region ---------物理参数---------
    //同一类预制体 物理参数一致
    public static paramRecs: { [type: string]: PhyInitParam } = {};
    curParam = null;
    initPhyParams() {
        if (MergeEffect.paramRecs[this.node.name]) {
            this.curParam = MergeEffect.paramRecs[this.node.name];
            return;
        };
        let param = new PhyInitParam();
        //物理参数
        param.lineSpd.set(this.lineSpd);
        param.lineFloat.set(this.lineFloat);
        param.lineDamping.set(this.lineDamping);

        param.rotSpd.set(this.rotSpd);
        param.rotFloat.set(this.rotFloat);
        param.rotDamping.set(this.rotDamping);

        param.initScale = this.initScale;
        param.scaleFloat = this.scaleFloat;
        param.scaleSpd = this.scaleSpd;

        param.opacity = this.opacity;
        param.opacitySpd = this.opacitySpd;

        param.delayTime = this.animTime;
        MergeEffect.paramRecs[this.node.name] = param;
        this.curParam = param;
    }

    resetParams() {

    }

    //#endregion

    //#region ----------材质----------
    _pass: renderer.Pass = null;
    //xyz:坐标 ,w缩放
    _trans0Handle = 0;
    _trans0Arr: Vec4[] = [];
    //xyz:旋转 ,w透明度(0-1)
    _trans1Handle = 0;
    _trans1Arr: Vec4[] = [];

    initMats() {
        this._pass = this.meshRenderer.getMaterialInstance(0).passes[0];
        this._trans0Handle = this._pass.getHandle('trans0');
        this._trans1Handle = this._pass.getHandle('trans1');

        for (let i = 0; i < this.max; i++) {
            this._trans0Arr.push(v4(0, 0, 0, 0));
            this._trans1Arr.push(v4(0, 0, 0, 0));
        }
    }
    setMat() {
        this.resetMat();
    }
    resetMat() {
        for (let i = 0; i < this.max; i++) {
            this._trans0Arr[i].set(0, 0, 0, 0);
            this._trans1Arr[i].set(0, 0, 0, 0);
        }
        this.applyTrans();
    }

    applyTrans() {
        if (this._pass) {
            this._pass.setUniformArray(this._trans0Handle, this._trans0Arr);
            this._pass.setUniformArray(this._trans1Handle, this._trans1Arr);
        }
    }

    updateMats(dt) {
        this.applyTrans();
    }
    //#endregion

    //#region ----------效果控制------
    effectRecs: MergeGroup[] = [];
    isAllFinish = false;

    initEffects() {
        //-----
        this.groupNum = Math.floor(this.groupNum);
        let n = Math.floor(this.max / this.groupNum);
        let startIndex = 0;
        let endIndex = 0;
        for (let i = 0; i < n; i++) {
            startIndex = this.groupNum * i;
            endIndex = this.groupNum * (i + 1) - 1;
            let e = new MergeGroup(startIndex, endIndex, this.curParam);
            e.init();
            // console.log(startIndex, ' ', endIndex);
            this.effectRecs.push(e);
        }
    }
    setEffects() {
        for (let i = 0; i < this.effectRecs.length; i++) {
            const e = this.effectRecs[i];
            e.reset();
        }
        this.isAllFinish = false;
    }

    resetEffects() {
        for (let i = 0; i < this.effectRecs.length; i++) {
            const e = this.effectRecs[i];
            e.reset();
        }
        this.isAllFinish = false;
    }

    updateEffects(dt) {

        if (this.isAllFinish) {
            this.node.active = false;
        } else {
            for (let i = 0; i < this.effectRecs.length; i++) {
                const e = this.effectRecs[i];
                e.update(dt);
                //设置参数
                for (let n = e.startIndex, k = 0; n <= e.endIndex; n++, k++) {
                    const item = e.items[k];

                    //xyz 位置 w缩放
                    this._trans0Arr[n].set(item.pos.x, item.pos.y, item.pos.z, item.scale * item.activeNum);
                    //xyz 旋转 w透明度
                    this._trans1Arr[n].set(item.rot.x, item.rot.y, item.rot.z, item.opacity);
                }
                this.isAllFinish = this.isAllFinish && e.isFinish;
            }
        }
    }
    //显示效果
    showEffect(d: { p: Vec3 }): boolean {
        let hasEffect = false;
        for (let i = 0; i < this.effectRecs.length; i++) {
            const e = this.effectRecs[i];
            if (e.isFinish) {
                hasEffect = true;
                e.setActive(true, d.p);
                this.node.active = true;
                this.isAllFinish = false;
                break;
            }
        }
        return hasEffect;
    }

    //#endregion


}
