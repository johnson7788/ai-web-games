import { _decorator, Component, Node } from 'cc';
import Tools from '../../../Init/Tools/Tools';
import { BasicSkeleAnim } from '../Common/Basic/BasicSkeleAnim';
import { Enemy } from './Enemy';
const { ccclass, property } = _decorator;


@ccclass('EnemyAnim')
export class EnemyAnim extends BasicSkeleAnim {
    cmp: Enemy = null;
    onEvents(): void {
        // this.anim['onAtk'] = this.onAtk.bind(this);
    }

    offEvents(): void {
        // this.anim['onAtk'] = null;
    }

    init(cmp: Enemy): void {
        super.init();
        this.cmp = cmp;

    }

    reset() {
        super.reset();
        Tools.clearObj(this);
    }

    //#region ----------set/get----------

    //#region 

    //#region -----------事件-------------
    //攻击帧事件
    onAtk() {
        // this.cmp && this.cmp.onAtk();
    }
    //#endregion
}

