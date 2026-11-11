import { _decorator, Component, Node, Vec3, v3, v2 } from 'cc';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import { BasicLayer } from '../../Common/Basic/BasicLayer';
import { MergeBasic } from './MergeBasic';
const { ccclass, property } = _decorator;

@ccclass('MergeEffectLayer')
export class MergeEffectLayer extends BasicLayer {

    allMergeEffects: { [t: string]: MergeBasic[] } = {};
    //提前创建的具体效果名称
    initMergeTypes = [
        GlobalEnum.MergeEffectType.MergeShadow,
        GlobalEnum.MergeEffectType.MergePistolBullet,
        GlobalEnum.MergeEffectType.MergeRocketSmook,
        GlobalEnum.MergeEffectType.MergeRoleDeath,
    ];

    // #region -------------------------------层级生命周期------------
    /**初始化 只执行一次*/
    protected init() {
        //提前创建
        for (let i = 0; i < this.initMergeTypes.length; i++) {
            const t = this.initMergeTypes[i];
            if (!this.allMergeEffects[t]) {
                this.allMergeEffects[t] = [];
                let effect = GlobalPool.get(t);
                effect.parent = this.node;
                effect.position.set(0, 0, 0);
                let cmp = effect.getComponent(MergeBasic);
                this.allMergeEffects[t].push(cmp);
            }
        }
    };
    /**注册通过自定义事件管理器管理的事件  */
    protected onEvents() {
        this.on(EventTypes.EffectEvents.showMergeEffect, this.onShowMergeEffect, this);

    };
    /**设置状态、数据等, */
    public setData(data?: any) {

    };
    /**重置状态、数据等，子类实现 ,注销事件*/
    public reset() {
        for (const key in this.allMergeEffects) {
            const e = this.allMergeEffects[key];
            for (let i = 0; i < e.length; i++) {
                GlobalPool.put(e[i].node);
                e[i].reset();
            }

            delete this.allMergeEffects[key];
        }
        this.allMergeEffects = {};
    }
    //游戏中 update
    public customUpdate(dt: number) {
        for (const key in this.allMergeEffects) {
            const e = this.allMergeEffects[key];
            for (let i = 0; i < e.length; i++) {
                e[i].customUpdate(dt);
            }
        }
        // this.testUpdate(dt);
    }

    public customLateUpdate(dt: number) {
        for (const key in this.allMergeEffects) {
            const e = this.allMergeEffects[key];
            for (let i = 0; i < e.length; i++) {
                e[i].customLateUpdate(dt);
            }
        }
        // this.testUpdate(dt);
    }

    // #endregion

    //#region ------------------事件-----------------
    //合并模型动画
    private onShowMergeEffect(t: GlobalEnum.MergeEffectType, d: any) {
        let hasEmpty = false;

        if (!this.allMergeEffects[t]) {
            this.allMergeEffects[t] = [];
        }
        for (let i = 0; i < this.allMergeEffects[t].length; i++) {
            const e = this.allMergeEffects[t][i];
            if (e.showEffect(d)) {
                hasEmpty = true;
                break;
            }
        }

        if (!hasEmpty) {
            let effect = GlobalPool.get(t);
            effect.parent = this.node;
            effect.position.set(0, 0, 0);
            let cmp = effect.getComponent(MergeBasic);
            cmp.showEffect(d);
            this.allMergeEffects[t].push(cmp);
        }
    }

    //#region 


    //#region ------------Test-------
    _testT = 0;
    testCD = 1;
    testFrameNum = 1;
    testRange = v3(5, 0, 5);

    public testUpdate(dt) {
        this._testT += dt;
        if (this._testT >= this.testCD) {
            this._testT = 0;
            let p = v3();
            for (let n = 0; n < this.testFrameNum; n++) {
                p.x = (2 * Math.random() - 1) * this.testRange.x;
                p.y = (2 * Math.random() - 1) * this.testRange.y;
                p.z = (2 * Math.random() - 1) * this.testRange.z;
                this.onShowMergeEffect(GlobalEnum.MergeEffectType.MergeFrameAnim, { p: p })
            }
        }
    }

    //#endregion
}


