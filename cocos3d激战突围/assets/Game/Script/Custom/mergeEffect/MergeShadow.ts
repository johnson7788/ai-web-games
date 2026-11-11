import { _decorator, Component, Node, MeshRenderer, Mesh, utils, renderer, v3, Vec3, v4, Vec4 } from 'cc';
import { MergeBasic } from './MergeBasic';
import { MergeMesh } from './MergeMesh';
const { ccclass, property } = _decorator;

@ccclass('MergeShadow')
export class MergeShadow extends MergeBasic {

    meshRenderer: MeshRenderer = null;
    //单个MergeEffect最大合并数量
    private max = 110; //220 / 2

    /**需要合并的mesh */
    @property({ type: Mesh, displayName: '合并模型' })
    mergeMesh: Mesh = null;

    static meshData: MergeMesh = null;

    // #region ---------流程--------------

    initSub() {
        this.meshRenderer = this.node.getComponent(MeshRenderer);
        //同类型的mesh 共享 meshData;
        if (!MergeShadow.meshData) {
            MergeShadow.meshData = new MergeMesh();
            MergeShadow.meshData.init(this.mergeMesh, this.max,);
            console.log('init:', this.node.name);
        }
        this.meshRenderer.mesh = utils.createMesh(MergeShadow.meshData.meshData);
        this.initMats();
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
    customLateUpdate(dt) {
        this.lateUpdateEffects(dt);
    }
    // #endregion

    //#region ----------材质----------
    _pass: renderer.Pass = null;
    //xyz:坐标 ,w缩放
    _trans0Handle = 0;
    _trans0Arr: Vec4[] = [];

    initMats() {
        this._pass = this.meshRenderer.getMaterialInstance(0).passes[0];
        this._trans0Handle = this._pass.getHandle('trans0');

        for (let i = 0; i < this.max; i++) {
            this._trans0Arr.push(v4(0, 0, 0, 0));
        }
    }
    setMat() {
        this.reset();
    }
    resetMat() {
        for (let i = 0; i < this.max; i++) {
            this._trans0Arr[i].set(0, 0, 0, 0);
        }
        this.applyTrans();
    }

    applyTrans() {
        if (this._pass) {
            this._pass.setUniformArray(this._trans0Handle, this._trans0Arr);
        }
    }

    updateMats(dt) {
        this.applyTrans();
    }
    //#endregion

    //#region ----------效果控制------
    effectRecs: ShadowItem[] = [];
    isAllFinish = false;

    initEffects() {
        for (let i = 0; i < this.max; i++) {
            let e = new ShadowItem(i);
            e.init();
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
            this.isAllFinish = true;

            for (let i = 0; i < this.effectRecs.length; i++) {
                const item = this.effectRecs[i];
                //-----设置参数
                if (!!item.param) {
                    this.isAllFinish = false;
                    //xyz 位置 w缩放
                    this._trans0Arr[item._index].set(item.param.pos.x, item.param.pos.y + 0.1, item.param.pos.z, item.scale * item.activeNum);
                    if (!item.param.isShow) {
                        item.reset();
                    }
                } else {
                    this._trans0Arr[item._index].set(0, 0, 0, 0);
                }

            }
        }
    }

    lateUpdateEffects(dt) {

    }
    //显示效果
    showEffect(d: { pos: Vec3, scale: number, isShow: boolean }): boolean {
        let hasEffect = false;
        for (let i = 0; i < this.effectRecs.length; i++) {
            const e = this.effectRecs[i];
            if (!e.param) {
                hasEffect = true;
                e.setActive(d);
                this.node.active = true;
                this.isAllFinish = false;
                break;
            }
        }
        return hasEffect;
    }
    //#endregion
}

export class ShadowItem {
    _index = 0;
    scale = 0;
    activeNum = 0;
    param: { pos: Vec3, scale: number, isShow: boolean } = null;

    constructor(index) {
        this._index = index;
    }
    init() {

    }
    setActive(d: { pos: Vec3, scale: number, isShow: boolean }) {
        this.scale = d.scale;
        this.activeNum = 1;
        this.param = d;
    }

    reset() {
        this.activeNum = 0;
        this.param = null;
    }

}