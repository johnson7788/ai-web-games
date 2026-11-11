import { _decorator, Component, Node, Enum, MeshRenderer, Mesh, utils, renderer, Vec4, v4, Vec3, v3, size } from 'cc';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { MergeBasic } from '../mergeEffect/MergeBasic';
import { MergeMesh } from '../mergeEffect/MergeMesh';
import { BasicBullet } from './BasicBullet';
const { ccclass, property } = _decorator;

@ccclass('MergeBullet')
export class MergeBullet extends MergeBasic {
    @property({ type: Enum(GlobalEnum.WeaponType) })
    weaponType: GlobalEnum.WeaponType = 0;

    meshRenderer: MeshRenderer = null;
    //单个MergeEffect最大合并数量
    static meshRecs: { [type: number]: MergeMesh } = {};
    private max = 110; //220 / 2

    /**需要合并的mesh */
    @property({ type: Mesh, displayName: '合并模型' })
    mergeMesh: Mesh = null;

    //-------子弹参数---------
    @property
    animTime = 3;
    @property
    initAngY = 0; //模型默认朝向
    @property
    bulletSize = size();
    @property
    isCircleCollider = false;
    @property
    bulletScale = 1;

    // #region ---------流程--------------

    initSub() {
        this.meshRenderer = this.node.getComponent(MeshRenderer);
        //同类型的mesh 共享 meshData;
        if (!MergeBullet.meshRecs[this.weaponType]) {
            MergeBullet.meshRecs[this.weaponType] = new MergeMesh();
            MergeBullet.meshRecs[this.weaponType].init(this.mergeMesh, this.max,);
            console.log('init:', this.node.name);
        }
        // let ms = new MergeMesh();
        // ms.init(this.mergeMesh, this.max,);

        this.meshRenderer.mesh = utils.createMesh(MergeBullet.meshRecs[this.weaponType].meshData);
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
        this.reset();
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
    effectRecs: BasicBullet[] = [];
    isAllFinish = false;

    initEffects() {
        let initRot = v3(0, this.initAngY, 0);
        for (let i = 0; i < this.max; i++) {
            let e = new BasicBullet(i, this.weaponType, initRot);
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
            for (let i = 0; i < this.effectRecs.length; i++) {
                const item = this.effectRecs[i];
                !item.isFinish && item.update(dt);
                //-----设置参数
                //xyz 位置 w缩放
                this._trans0Arr[item._index].set(item.pos.x, item.pos.y, item.pos.z, item.scale * item.activeNum);
                //xyz 旋转 w透明度
                this._trans1Arr[item._index].set(item.rot.x, item.rot.y, item.rot.z, item.opacity);
                this.isAllFinish = this.isAllFinish && item.isFinish;
            }
        }
    }

    lateUpdateEffects(dt) {
        if (!this.isAllFinish) {
            for (let i = 0; i < this.effectRecs.length; i++) {
                const item = this.effectRecs[i];
                item.lateUpdate(dt);
            }
        }
    }
    //显示效果
    showEffect(d: { pos: Vec3, lineVec: Vec3, rotSpd: Vec3, atkRate: number }): boolean {
        let hasEffect = false;
        for (let i = 0; i < this.effectRecs.length; i++) {
            const e = this.effectRecs[i];
            if (e.isFinish) {
                hasEffect = true;
                e.setActive(d.pos, d.lineVec, d.rotSpd, d.atkRate, this.animTime, this.bulletSize, this.bulletScale, this.isCircleCollider);
                this.node.active = true;
                this.isAllFinish = false;
                break;
            }
        }
        return hasEffect;
    }

    //#endregion

}

