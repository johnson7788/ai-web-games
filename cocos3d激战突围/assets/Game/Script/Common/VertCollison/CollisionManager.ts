import { _decorator, Component, Node, Size, v3, Vec3, size, Rect, rect, Intersection2D, v2 } from 'cc';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { LevelDataTmp } from '../../../../Init/SystemStorage/StorageTemp';
import { BasicLayer } from '../Basic/BasicLayer';
import { BasicCollider } from './BasicCollider';
const { ccclass, } = _decorator;
const TMPV3 = v3();
const NoneRes = {};

//碰撞分组
export enum ColliderGroup {
    None = 0,
    //玩家
    Player,
    //玩家子弹
    PlayerBullet,
    //敌人
    Enemy,
    //敌人子弹
    EnemyBullet,
    //道具
    Prop,
    //对所有角色
    Trap,
    //障碍-阻碍行动
    Barrier,
    //只能玩家触发
    PlayerTrigger,
    //只对敌人触发
    EnemyTrigger,
}

//碰撞分组配置 :检测对象类型->优化 :少数检测多数
export const GroupConfig = {
    0: [],
    //玩家
    1: [7],
    //玩家子弹
    2: [3],
    //敌人
    3: [],
    //敌人子弹
    4: [1],
    //道具
    5: [1],
    //陷阱
    6: [1],
    //障碍-阻碍行动
    7: [],
    //只能玩家触发
    8: [1],
    //只对敌人碰撞
    9: [3],

}

@ccclass('CollisionManager')
export class CollisionManager extends BasicLayer {

    //** 三位数组 对应xyz 以地图坐标为原点的坐标系记录*/
    public static gridInfo: { [groupId: number]: number[] }[][] = [];

    //根据Id 记录所有的碰撞体 BasicCollider
    public static allColliderRecs: { [colId: number]: BasicCollider<any> } = {};

    //地图尺寸-** xz平面(原点左上角 第4象限) xy平面(原点左下角 第2象限)** 
    public static mapSize: Vec3 = v3();
    //格子尺寸
    public static gridSize: Vec3 = v3(1, 1, 1);
    //地图坐标原点
    public static mapWpos: Vec3 = v3();

    // #region -----------流程------------ 
    public onEvents() {
        // this.on(EventTypes.GridMapEvents.CreateMapData, this.createMapData, this);
    }

    public reset() {
        //释放
        for (let i = 0; i < CollisionManager.gridInfo.length; i++) {
            const info = CollisionManager.gridInfo[i];
            if (info) {
                for (let j = 0; j < info.length; j++) {
                    const rec = info[j];
                    if (rec) {
                        for (const key in rec) {
                            rec[key] = null;
                        }
                    }
                }
            }
        }

        CollisionManager.gridInfo = [];
        CollisionManager.allColliderRecs = {};
        // BasicCollider._COLLODERINDEX = 1;
    }
    //每次生成地图前调用
    public setData(d: LevelDataTmp): void {
        // this.createMapData();
    }

    public createMapData(mp: Vec3) {
        let mapSize = size(mp.x * 2, mp.z * 2); //test----
        CollisionManager.mapSize.set(mapSize.width, 1, mapSize.height);
        //根据地图大小 计算自身坐标 xy平面-左上角原点
        let p = v3(-mapSize.width * 0.5, 0, -mapSize.height * 0.5);

        //以自身位置为坐标原点 来计算
        let wp = v3(p);
        Vec3.round(wp, wp);
        CollisionManager.mapWpos.set(wp);

        let ms = CollisionManager.mapSize;
        let gs = CollisionManager.gridSize;
        //创建地图数据,且数据超出一格
        let _size = v3();
        _size.x = ms.x / gs.x;
        _size.y = ms.y / gs.y;
        _size.z = ms.z / gs.z;

        //向上取整
        Vec3.ceil(_size, _size);
        let pos = v3();
        //xz平面 数据原点在左上角
        let t0 = Date.now();

        for (let x = 0; x <= _size.x; x++) {
            pos.x = Math.ceil(x); //对坐标偏移和缩放
            CollisionManager.gridInfo[pos.x] = [];

            // for (let y = 0; y <= _size.y; y++) {
            // pos.y = 0;
            // CollisionManager.gridInfo[pos.x][pos.y] = [];

            for (let z = 0; z <= _size.z; z++) {
                pos.z = Math.ceil(z);
                const info = {};

                for (const key in ColliderGroup) {
                    const _id: any = key;
                    if (!isNaN(_id)) {
                        info[+key] = [];
                    }
                }
                CollisionManager.gridInfo[pos.x][pos.z] = info;
            }
            // }
        }

        let t1 = Date.now();
        console.log('# 碰撞管理创建: ', t1 - t0, 'ms');
    }

    public update(dt: number) {

    }

    // #endregion

    // #region -----------对外------------
    /**
     * 根据碰撞id记录碰撞体
     * @param colId 
     * @param collider 
     */
    public static setColilderByColId(colId: number, collider: any) {
        this.allColliderRecs[colId] = collider;
    }
    /**
     * 根据碰撞id获取碰撞体
     * @param colId 
     * @returns 
     */
    public static getColilderByColId(colId: number): BasicCollider<any> {
        return this.allColliderRecs[colId];
    }

    /**移除碰撞体 */
    public static removeColliderByColId(colId: number) {
        if (this.allColliderRecs[colId]) {
            delete this.allColliderRecs[colId];
        }
    }
    /**
     * 获取指定位置下的信息
     * @param wpos 
     * @returns 
     */
    public static getInfo(wpos: Vec3): { [groupId: number]: number[] } {
        Vec3.subtract(TMPV3, wpos, this.mapWpos);
        TMPV3.divide(this.gridSize);
        Vec3.ceil(TMPV3, TMPV3);
        // TMPV3.y = 0; //xz平面
        if (this.gridInfo[TMPV3.x] && this.gridInfo[TMPV3.x][TMPV3.z]) {
            return this.gridInfo[TMPV3.x][TMPV3.z];
        }
        return NoneRes;
    }
    /**
     * 获取指定位置下指定分组的信息
     * @param wpos 
     * @param groupArr 
     * @returns 
     */
    public static getInfoByGroup(wpos: Vec3[], groupArr: number[], outRes?: { [groupId: number]: number[] }): { [groupId: number]: number[] } {
        outRes = outRes || {};
        for (let i = 0; i < wpos.length; i++) {
            const p = wpos[i];
            const res = this.getInfo(p);

            for (let g = 0; g < groupArr.length; g++) {
                const gId = groupArr[g];
                if (res[gId]) {
                    if (!outRes[gId]) {
                        outRes[gId] = [];
                    }
                    for (let i = 0; i < res[gId].length; i++) {
                        const colId = res[gId][i];
                        if (colId >= 0 && outRes[gId].indexOf(colId) < 0) {
                            outRes[gId].push(colId);
                        }
                    }
                }
            }
        }
        return outRes;
    }

    /**
     * 记录指定位置下的信息
     * @param wpos 
     * @param groupId 
     * @param selfId 
     * @param outPos 返回在地图中的位置(缩放后)
     * @returns 记录自身Id的在存储数组中的位置
     */
    public static setInfo(wpos: Vec3, groupId: number, selfId: number, outPos: Vec3) {
        Vec3.subtract(TMPV3, wpos, this.mapWpos);
        TMPV3.divide(this.gridSize);
        Vec3.ceil(TMPV3, TMPV3);
        outPos.set(TMPV3);
        TMPV3.y = 0; //xz平面

        //固定地图大小时 超出范围-
        // if (!this.gridInfo[TMPV3.x] || !this.gridInfo[TMPV3.x][TMPV3.z]) {
        //     // clog.warn('groupId: ' + groupId + ' 记录失败');
        //     return -1;
        // }

        //创建新记录
        if (!this.gridInfo[TMPV3.x]) {
            this.gridInfo[TMPV3.x] = [];
        }
        if (!this.gridInfo[TMPV3.x][TMPV3.z]) {
            this.gridInfo[TMPV3.x][TMPV3.z] = {};
        }
        if (!this.gridInfo[TMPV3.x][TMPV3.z][groupId]) {
            this.gridInfo[TMPV3.x][TMPV3.z][groupId] = [];
        }

        const info = this.gridInfo[TMPV3.x][TMPV3.z][groupId];
        let index = info.indexOf(selfId);
        if (index >= 0) return index;
        //寻找可替换(-1)的位置
        for (let i = 0; i < info.length; i++) {
            if (info[i] < 0) {
                info[i] = selfId;
                index = i;
                break;
            }
        }
        if (index < 0) {
            info.push(selfId);
            index = info.length - 1;
        }
        return index;
    }
    /**
     * 清除 使用-1标记
     * @param posId 
     * @param groupId 
     * @param selfId 
     * @param selfIdIndex 自身id下标
     */
    public static clearInfo(posId: Vec3, groupId: number, selfId: number, selfIdIndex: number) {
        TMPV3.set(posId);
        if (!this.gridInfo[TMPV3.x] || !this.gridInfo[TMPV3.x][TMPV3.z]) {
            return false;
        }
        const info = this.gridInfo[TMPV3.x][TMPV3.z][groupId];
        if (info[selfIdIndex] >= 0 && info[selfIdIndex] == selfId) {
            info[selfIdIndex] = -1;
        }
        return true;
    }
    // #endregion

}


/**
 * 针对 collisionManager 的工具类   
 */
export class CollisionTools {
    private static _tmpArr: Vec3[] = [];
    private static _tmpRect = rect();
    private static _tmpV2 = v2();
    /**
     * 根据半径+中心点位置获取矩形
     * @param p 
     * @param dist 
     * @returns 
     */
    public static getRectByPos(p: Vec3, dist: number,) {
        this._tmpRect.set(0, 0, dist * 2, dist * 2);
        this._tmpRect.center = this._tmpV2.set(p.x, p.z);
        return this._tmpRect;
    }
    /**
     * 粗略的 获取指定位置的范围内的所有碰撞体（矩形方式判断）XZ平面
     * @param p 
     * @param dist //矩形宽度的一半
     * @param outRes 
     * @param groupArr 
     * @returns 
     */
    public static getCollInfoByPos(p: Vec3, dist: number, outRes: { [groupId: number]: number[] }, groupArr?: number[],) {
        this._tmpArr = [];
        this._tmpRect.set(0, 0, dist * 2, dist * 2);
        this._tmpRect.center = this._tmpV2.set(p.x, p.z);
        this.updatePosRecFromRect(this._tmpRect, this._tmpArr);

        let isCollision = false;
        for (const key in this._tmpArr) {
            const p = this._tmpArr[key];
            let isColl = this.impreciseCheckByGroup(p, outRes, groupArr);
            if (isColl) {
                isCollision = true;
            }
        }

        return isCollision;
    }
    /**
     * 获取指定矩形内的所有碰撞体
     * @param rect 检测的矩形
     * @param outRes 返回信息
     * @param groupArr 需要获取的分组ID 不传表示所有
     * @returns  是否碰撞
     */
    public static getCollInfoByRect(rect: Rect, outRes: { [groupId: number]: number[] }, groupArr?: number[],) {
        this._tmpArr = [];
        this.updatePosRecFromRect(rect, this._tmpArr);

        let isCollision = false;
        for (const key in this._tmpArr) {
            const p = this._tmpArr[key];
            let isColl = this.impreciseCheckByGroup(p, outRes, groupArr);
            if (isColl) {
                isCollision = true;
            }
        }

        return isCollision;
    }
    /**
    * 根据Rect包围盒分割成多个计算点 xz平面
    */
    public static updatePosRecFromRect(rect: Rect, outArr: Vec3[]) {
        const gs = CollisionManager.gridSize;
        const _x = Math.ceil(rect.width / gs.x);
        const _z = Math.ceil(rect.height / gs.z);
        let i = 0;
        for (let x = 0; x <= _x; x++) {
            for (let z = 0; z <= _z; z++) {
                if (!outArr[i]) {
                    outArr[i] = v3();
                }
                outArr[i].set(x * gs.x, 0, z * gs.z);
                outArr[i].add3f(rect.x, 0, rect.y)
                i++;
            }
        }
    }
    //#region -----粗略检测方法-----
    /**
        * 根据自身的矩形包围盒(selfRect)来计算碰撞粗略信息--推荐方法
        * @param isCheckGroup 是否根据分组配置检测
        * @param out //返回信息
        */
    public static impreciseCheckByRect(selfGroup: ColliderGroup, selfId: number, curRectPosArr: Vec3[], out: { [groupId: number]: number[] }, isCheckGroup = true) {
        let isCollision = false;
        for (const key in curRectPosArr) {
            const p = curRectPosArr[key];
            let isColl = this.impreciseCheckByPos(selfGroup, selfId, p, out, isCheckGroup);
            if (isColl) {
                isCollision = true;
            }
        }
        return isCollision;
    }

    /**
      * 粗略的 返回初步检测的碰撞信息 -不包含自身
      * @param pos 位置 
      * @param outRes 返回的信息
      * @param isCheckGroup 是否根据分组配置检测
      * @returns 
      */
    public static impreciseCheckByPos(selfGroup: ColliderGroup, selfId: number, pos: Vec3, outRes: { [groupId: number]: number[] }, isCheckGroup = true) {
        let isColl = false;
        const res = CollisionManager.getInfo(pos);
        if (!res) {
            console.warn('# 获取检测数据错误 pos:' + pos);
            return false;
        }
        //根据碰撞分组信息检测
        for (const key in res) {
            const arr = res[key];
            const groupId = +key;

            //是否根据分组来检测 是否能发生碰撞
            if (arr.length > 0 &&
                ((isCheckGroup && GroupConfig[selfGroup].indexOf(groupId) >= 0) || !isCheckGroup)) {
                if (!outRes[groupId]) {
                    outRes[groupId] = [];
                }
                //记录碰撞的id (id>=0)
                for (let j = 0; j < arr.length; j++) {
                    const colId = arr[j];
                    //过滤重复id与自身id
                    if (colId >= 0 && colId != selfId && outRes[groupId].indexOf(colId) < 0) {
                        outRes[groupId].push(colId);
                    }
                }
                if (!isColl) {
                    isColl = outRes[groupId].length > 0;
                }
            }

        }
        return isColl;
    }

    /**粗略检测范围内的<指定分组>物体
     * 
     */
    public static impreciseCheckByGroup(pos: Vec3, outRes: { [groupId: number]: number[] }, groupArr?: number[]) {
        let isColl = false;
        const res = CollisionManager.getInfo(pos);
        if (!res) {
            console.warn('# 获取检测数据错误 pos:' + pos);
            return false;
        }
        //根据碰撞分组信息检测
        for (const key in res) {
            const arr = res[key];
            const groupId = +key;

            //是否根据分组来检测 是否能发生碰撞
            if (arr.length > 0 && groupArr && groupArr.indexOf(groupId) >= 0) {
                if (!outRes[groupId]) {
                    outRes[groupId] = [];
                }
                //记录碰撞的id (id>=0)
                for (let j = 0; j < arr.length; j++) {
                    const colId = arr[j];

                    if (colId >= 0 && outRes[groupId].indexOf(colId) < 0) {
                        outRes[groupId].push(colId);
                    }
                }
                if (!isColl) {
                    isColl = outRes[groupId].length > 0;
                }
            }
        }
        return isColl;
    }

    //#endregion

    //#region -----精细检测方法

    /**
     * 将自身的pos与矩形宽度 与给定的colIdArr 做精细碰撞检测 每次检测碰撞后回调一次
     * @param p 当前检测位置
     * @param dist 检测矩形宽度的一半
     * @param colIdArr 检测id
     * @param cb 
     * @param isCheckTrigger 
     * @returns 
     */
    public static checkPosByColIdArrCb(p: Vec3, dist: number, colIdArr: number[], cb: (out: { colId: number, rect: Rect }) => void, isSelfCircle = false, isCheckTrigger = true) {
        if (!colIdArr) return false;
        let out = { colId: -1, rect: this._tmpRect };
        this._tmpRect.set(0, 0, dist * 2, dist * 2);
        this._tmpRect.center = this._tmpV2.set(p.x, p.z);
        for (let i = 0; i < colIdArr.length; i++) {
            if (this.checkRectByColId(this._tmpRect, colIdArr[i], out, isSelfCircle, isCheckTrigger)) {
                cb && cb(out);
            }
        }
        return false;
    }

    /**
  * 将自身的rect 与给定的colIdArr 做精细碰撞检测 每次检测碰撞后回调一次
  * @param colIdArr 
  * @param out 碰撞到的矩形
  */
    public static checkRectByColIdArrCb(selfRect: Rect, colIdArr: number[], cb: (out: { colId: number, rect: Rect }) => void, isSelfCircle = false, isCheckTrigger = true) {
        if (!colIdArr) return false;
        let out = { colId: -1, rect: this._tmpRect };
        for (let i = 0; i < colIdArr.length; i++) {
            if (this.checkRectByColId(selfRect, colIdArr[i], out, isSelfCircle, isCheckTrigger)) {
                cb && cb(out);
            }
        }
        return false;
    }

    /**
     * 将自身的rect 与给定的colIdArr 做精细碰撞检测 检测到一次后就返回 
     * @param colIdArr 
     * @param out 碰撞到的矩形
     */
    public static checkRectByColIdArr(selfRect: Rect, colIdArr: number[], out?: { colId: number, rect: Rect }, isSelfCircle = false, isCheckTrigger = true) {
        if (!colIdArr) return false;

        for (let i = 0; i < colIdArr.length; i++) {
            if (this.checkRectByColId(selfRect, colIdArr[i], out, isSelfCircle, isCheckTrigger)) {
                return true;
            }
        }
        return false;
    }

    private static _tmpDirec = v2();
    /**
   * 将自身的rect 与给定的colId 做精细碰撞检测
   */
    public static checkRectByColId(selfRect: Rect, colId: number, out?: { colId: number, rect: Rect, fixPos?: Vec3 }, isSelfCircle = false, isCheckTrigger = true) {
        let isColl = false;
        const otherCollider = CollisionManager.getColilderByColId(colId);
        if (otherCollider) {
            if (isCheckTrigger || !isCheckTrigger && !otherCollider.isTrigger) {
                this._tmpRect.set(otherCollider.selfRect);
                const scp = selfRect.center;
                const ocp = otherCollider.selfRect.center;
                const scw = selfRect.width * 0.5;
                const ocw = otherCollider.selfRect.height * 0.5;
                //1.双方都是圆形
                if (isSelfCircle && otherCollider.isCircleCollider) {
                    //使用圆形检测
                    isColl = Intersection2D.circleCircle(scp, scw, ocp, ocw);
                    //位置修正
                    if (isColl && out && out.fixPos) {
                        this._tmpDirec.set(scp).subtract(ocp);
                        this._tmpDirec.normalize().multiplyScalar(scw + ocw).add(ocp);
                        out.fixPos.set(this._tmpDirec.x, 0, this._tmpDirec.y);
                    }

                }

                //2.双方都使用矩形检测
                if (!isSelfCircle && !otherCollider.isCircleCollider) {
                    isColl = Intersection2D.rectRect(selfRect, this._tmpRect);
                }

                //3.自身圆形 对方矩形
                if (isSelfCircle && !otherCollider.isCircleCollider) {
                    isColl = Intersection2D.rectCircle(otherCollider.selfRect, scp, scw);
                }

                //4.自身矩形 对方圆形
                if (!isSelfCircle && otherCollider.isCircleCollider) {
                    isColl = Intersection2D.rectCircle(selfRect, ocp, ocw);
                }

                if (isColl && out) {
                    out.colId = colId;
                    out.rect.set(this._tmpRect);
                }
            }
        }
        return isColl;
    }
    //#endregion

}