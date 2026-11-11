import { v3, Vec3 } from "cc";
import { GlobalEnum } from "./GlobalEnum";

export class HPInfo {
    isShow: boolean = true;
    rate: number = 1;
    curRate: number = 1;
    isPlayer: boolean = false;
    wpos: Vec3 = v3();
    countTime: number = 0;
    type: number = 0;
    //
    isShadowReady = false;
}

export class BossHPInfo {
    bossName: string;
    rate: number = 1;
    curRate: number = 1;
    countTime: number = 0;
    //
    isShadowReady = false;
}

/**路段信息 */
export class PathInfo {
    n: string;
    p = v3();       //世界坐标
    //路段路径
    path: Vec3[] = []; //世界坐标

}


//武器信息
export class WeaponInfo {
    /**攻击 */
    atk = 0;
    atkSpd = 1;
    perfab = '';
    bullet = '';
    bulletSpd = 20;
    propScale = 1;
    //
    droneheight?= 4;
    boomRadius?= 2;
}

//陷阱信息
export class TrapInfo {
    /**攻击 */
    atk = 0;
    perfab = '';
    isMuilty = false;

    //攻击比例
    atkRate?= 1;
    //攻速 次/s
    atkSpd?= 1;
    //子弹速度
    bulletSpd?= 10;
    //子弹类型
    bulletType?= 'mergePistolBullet';
}