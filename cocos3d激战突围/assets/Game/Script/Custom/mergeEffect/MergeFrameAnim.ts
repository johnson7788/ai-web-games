import { _decorator, Component, Node, CCInteger, Enum, Mesh, MeshRenderer, renderer, utils, v3, v4, Vec2, Vec3, Vec4, Color, color, v2, CCFloat, CCBoolean } from 'cc';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import Tools from '../../../../Init/Tools/Tools';
import { MergeBasic } from './MergeBasic';
import { MergeFrameGroup } from './MergeFrameGroup';
import { PhyInitParam, } from './MergeGroup';
import { MergeMesh } from './MergeMesh';
const { ccclass, property } = _decorator;

@ccclass('MergeFrameAnim')
export class MergeFrameAnim extends MergeBasic {
    @property({ type: Enum(GlobalEnum.MergeType) })
    mergeType: GlobalEnum.MergeType = 0;

    meshRenderer: MeshRenderer = null;
    //单个MergeEffect最大合并数量
    private max = 55; //220 / 4
    static meshRecs: { [type: number]: MergeMesh } = {};

    /**需要合并的mesh */
    @property({ type: Mesh, displayName: '合并模型', group: '合并参数' })
    mergeMesh: Mesh = null;
    /**按照合并数量 / 单组数量 = 组数*/
    @property({ type: CCInteger, displayName: '单组数量', step: 1, min: 1, max: 55, group: '合并参数' })
    groupNum: number = 1;

    @property({ type: CCInteger, displayName: '动画时长', step: 0.1, group: '合并参数' })
    animTime = 2;


    //#region ---------动画参数
    @property({ group: '物理参数' })
    lineSpd: Vec3 = v3();
    @property({ group: '物理参数' })
    lineFloat: Vec3 = v3();
    @property({ group: '物理参数' })
    lineDamping: Vec3 = v3();

    @property({ group: '物理参数' })
    rotSpd: Vec3 = v3();
    @property({ group: '物理参数' })
    rotFloat: Vec3 = v3();
    @property({ group: '物理参数' })
    rotDamping: Vec3 = v3();

    @property({ group: '物理参数' })
    initScale = 1;
    @property({ group: '物理参数' })
    scaleFloat = 0;
    @property({ group: '物理参数' })
    scaleSpd = 0;
    //

    @property({ group: '颜色' })
    opacity = 1;
    @property({ group: '颜色' })
    opacitySpd = 0;
    @property({ group: '颜色' })
    initColor: Color = color().fromHEX('#FFFFFF');
    @property({ group: '颜色' })
    toColor: Color = color().fromHEX('#FFFFFF');
    @property({ type: CCFloat, group: '颜色' })
    colorSpdRate = 0.5;
    @property({ group: '颜色' })
    colorLoop = false;

    //uv
    // @property({ displayName: '初始UV偏移', group: '帧动画' })
    uvArr: Vec2[] = [];
    // @property({ group: '帧动画' })
    initUvOffset: Vec2 = v2();
    // @property({ group: '帧动画' })
    uvOffsetMax: Vec2 = v2(1, 1);

    @property({ group: '帧动画', displayName: '贴图排列' })
    uvRange: Vec2 = v2();
    // @property({ group: '帧动画' })
    uvOffsetStep: Vec2 = v2();
    @property({ group: '帧动画', displayName: '播放间隔' })
    uvStepTime = 0.1;
    @property({ group: '帧动画', displayName: '是否循环' })
    uvLoop = false;

    maxFrame = 10;

    //#endregion

    // #region ---------流程--------------

    initSub() {
        this.meshRenderer = this.node.getComponent(MeshRenderer);
        //同类型的mesh 共享 meshData;
        if (!MergeFrameAnim.meshRecs[this.mergeType]) {
            MergeFrameAnim.meshRecs[this.mergeType] = new MergeMesh();
            MergeFrameAnim.meshRecs[this.mergeType].init(this.mergeMesh, this.max, this.uvArr);
            console.log('init:', this.node.name);
        }
        this.meshRenderer.mesh = utils.createMesh(MergeFrameAnim.meshRecs[this.mergeType].meshData);
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
    }

    customUpdate(dt) {
        this.updateEffects(dt);
        this.updateMats(dt);
    }

    // #endregion

    //#region ---------物理参数---------
    public static paramRecs: { [type: number]: PhyInitParam } = {};
    initPhyParams() {
        if (MergeFrameAnim.paramRecs[this.mergeType]) return;
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

        //uv
        this.maxFrame = this.uvRange.x * this.uvRange.y;
        this.uvOffsetStep.set(1 / this.uvRange.x, 1 / this.uvRange.y);
        param.initUvOffset.set(-this.uvOffsetStep.x, -this.uvOffsetStep.y);
        param.uvOffsetMax.set(this.uvOffsetMax);
        param.uvOffsetStep.set(this.uvOffsetStep);
        param.uvStepTime = this.uvStepTime;
        param.uvLoop = this.uvLoop;
        param.maxFrame = this.maxFrame;

        // color
        Tools.getColorRate(this.initColor, param.initColor);
        Tools.getColorRate(this.toColor, param.toColor);
        param.colorSpd = this.colorSpdRate;
        param.coloLoop = this.colorLoop;

        MergeFrameAnim.paramRecs[this.mergeType] = param;
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

    //xyz:旋转 ,w透明度(0-1)
    _trans2Handle = 0;
    _trans2Arr: Vec4[] = [];

    //xyz:旋转 ,w透明度(0-1)
    _trans3Handle = 0;
    _trans3Arr: Vec4[] = [];

    initMats() {
        //设置uv缩放        
        let mat = this.meshRenderer.getMaterialInstance(0)
        let param = v4(1 / this.uvRange.x, 1 / this.uvRange.y, 0, 0);
        //
        mat.setProperty('tilingOffset', param);
        //
        this._pass = mat.passes[0];
        this._trans0Handle = this._pass.getHandle('trans0');
        this._trans1Handle = this._pass.getHandle('trans1');
        this._trans2Handle = this._pass.getHandle('trans2');
        this._trans3Handle = this._pass.getHandle('trans3');

        for (let i = 0; i < this.max; i++) {
            this._trans0Arr.push(v4(0, 0, 0, 0));
            this._trans1Arr.push(v4(0, 0, 0, 0));
            this._trans2Arr.push(v4(0, 0, 0, 0));
            this._trans3Arr.push(v4(0, 0, 0, 0));
        }
    }
    setMat() {
        this.reset();
    }
    resetMat() {
        for (let i = 0; i < this.max; i++) {
            this._trans0Arr[i].set(0, 0, 0, 0);
            this._trans1Arr[i].set(0, 0, 0, 0);
            this._trans2Arr[i].set(0, 0, 0, 0);
            this._trans3Arr[i].set(0, 0, 0, 0);
        }
        this.applyTrans();
    }

    applyTrans() {
        if (this._pass) {
            this._pass.setUniformArray(this._trans0Handle, this._trans0Arr);
            this._pass.setUniformArray(this._trans1Handle, this._trans1Arr);
            this._pass.setUniformArray(this._trans2Handle, this._trans2Arr);
            this._pass.setUniformArray(this._trans3Handle, this._trans3Arr);
        }
    }

    updateMats(dt) {
        this.applyTrans();
    }
    //#endregion

    //#region ----------效果控制------
    effectRecs: MergeFrameGroup[] = [];
    isAllFinish = false;

    initEffects() {
        //-----
        let n = Math.floor(this.max / this.groupNum);
        let startIndex = 0;
        let endIndex = 0;
        for (let i = 0; i < n; i++) {
            startIndex = this.groupNum * i;
            endIndex = this.groupNum * (i + 1) - 1;
            let e = new MergeFrameGroup(startIndex, endIndex, MergeFrameAnim.paramRecs[this.mergeType]);
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
                    //xy uv偏移
                    this._trans2Arr[n].set(item.curUvOffset.x, item.curUvOffset.y, 0, 0);
                    //颜色
                    this._trans3Arr[n].set(item.curColor);
                }
                this.isAllFinish = this.isAllFinish && e.isFinish;
            }
        }
    }
    //显示效果
    showEffect(pos): boolean {
        let hasEffect = false;
        for (let i = 0; i < this.effectRecs.length; i++) {
            const e = this.effectRecs[i];
            if (e.isFinish) {
                hasEffect = true;
                e.setActive(true, pos);
                this.node.active = true;
                this.isAllFinish = false;
                break;
            }
        }
        return hasEffect;
    }

    //#endregion


}
