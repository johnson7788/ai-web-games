import { _decorator, Component, Node, SkeletalAnimation } from 'cc';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../Init/Config/GlobalTmpData';
import { clog } from '../../../Init/Tools/ColorLog';
import Tools from '../../../Init/Tools/Tools';
import { BasicSkeleAnim } from '../Common/Basic/BasicSkeleAnim';
import { Role } from './Role';
const { ccclass, property } = _decorator;

@ccclass('RoleAnim')
export class RoleAnim extends BasicSkeleAnim {

    role: Role = null;

    onEvents(): void {
        this.anim['onAtk'] = this.onAtk.bind(this);
    }

    offEvents(): void {
        this.anim['onAtk'] = null;
    }

    init(role: Role): void {
        super.init();
        this.role = role;
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
        if (GlobalTmpData.Game.isPause) return;
        this.role.onAtk();
    }
    //#endregion
}

