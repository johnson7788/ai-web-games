import { _decorator, Vec3, v3, Rect, v2, Size, Intersection2D, rect, CylinderCollider } from 'cc';
import { ColliderGroup, GroupConfig, CollisionManager, CollisionTools } from './CollisionManager';
const TMPP0 = v3();
const TMPP2 = v2();
/**碰撞基类 
 * 1.标记在碰撞地图中的数据
 * 2.检测自身在地图中可能碰撞到的物体
 * 3.每个对象绑定此碰撞体在回收之后 必须重建此对象 ！！
 */
export class BasicCollider<T> {
    //用于创建id
    public static _COLLODERINDEX = 1;
    //唯一碰撞体id
    public SelfId = 0;
    //分组id
    public GroupId = ColliderGroup.None;
    //是否是触发器-不阻碍移动
    public isTrigger = false;

    //记录前一帧的格子id 和 记录的id下标
    public prePosInfo: { p: Vec3, index: number }[] = [];
    //记录当前矩形分割后的坐标
    public curRectPosArr: Vec3[] = [];
    //自身尺寸  和格子的比例一致
    public selfRect: Rect = new Rect(0, 0, 1, 1);
    //判断位置是否更新
    public isDirty = false;

    //地图范围信息记录
    public mapRange = { maxX: 0, minX: 0, maxY: 0, minY: 0, maxZ: 0, minZ: 0, x: 0, y: 0, z: 0 };

    //当前碰撞体对应的节点 
    public targetCmp: T = null;

    //是否作为圆形碰撞检测 -- 限制移动检测时 使用圆形检测
    public isCircleCollider = false;

    constructor(groupId: ColliderGroup, targetCmp: T, isTrigger = false) {
        this.GroupId = groupId;
        this.targetCmp = targetCmp;
        this.isTrigger = isTrigger;
        this.init();
    }

    //#region -----------设置、更新信息----------
    /**设置碰撞矩形位置 */
    public setRectPos(p: Vec3) {
        if (p.x != this.selfRect.center.x ||
            p.z != this.selfRect.center.y) {
            this.selfRect.center = TMPP2.set(p.x, p.z);
            this.updatePosRecFromRect(this.selfRect, this.curRectPosArr);
            this.isDirty = true;
        }
    }
    /**设置单个点的位置(不使用矩形分割) */
    public setSinglePoint(p) {
        if (p.x != this.selfRect.center.x ||
            p.z != this.selfRect.center.y) {
            this.selfRect.center = TMPP2.set(p.x, p.z);
            this.updatePosRecFromPos(p);
            this.isDirty = true;
        }
    }

    /**设置碰撞矩形大小  */
    public setRectSize(s: Size) {
        if (s.width != this.selfRect.width ||
            s.height != this.selfRect.height) {
            this.selfRect.set(this.selfRect.x, this.selfRect.y, s.width, s.height);
            this.curRectPosArr = [];
            this.updatePosRecFromRect(this.selfRect, this.curRectPosArr);
            this.isDirty = true;
        }
    }
    /**清除在地图中的数据 */
    public clearGridInfo() {
        for (let j = 0; j < this.prePosInfo.length; j++) {
            CollisionManager.clearInfo(this.prePosInfo[j].p, this.GroupId, this.SelfId, this.prePosInfo[j].index);
        }
    }
    /**将此碰撞体从管理器中移除 */
    public removeFromManager() {
        CollisionManager.removeColliderByColId(this.SelfId);
    }

    //#endregion

    //#region -----------生命周期-----------
    public init(): void {
        //唯一id
        this.SelfId = BasicCollider._COLLODERINDEX++;
        //将碰撞rect 记录到 CollisionManager
        CollisionManager.setColilderByColId(this.SelfId, this);

        //地图范围信息 xz平面 原点左上角
        let wp = CollisionManager.mapWpos;
        let s = CollisionManager.mapSize;
        this.mapRange = {
            maxX: s.x + wp.x,
            minX: wp.x,
            maxY: s.y + wp.y,
            minY: wp.y,
            maxZ: s.z + wp.z,
            minZ: wp.z,
            x: wp.x, y: wp.y, z: wp.z
        }

    }
    public tmpP2 = v3();
    public stepP = v3();
    /**更新自身在地图的位置信息*/
    public updateGridInfo(isForth = false) {
        //
        if (!this.isDirty && !isForth) return;
        //清除之前位置下的信息
        this.clearGridInfo();
        //记录当前位置id
        for (let i = 0; i < this.curRectPosArr.length; i++) {
            if (!this.prePosInfo[i]) {
                this.prePosInfo[i] = { p: v3(), index: -1 };
            }
            this.prePosInfo[i].index = CollisionManager.setInfo(this.curRectPosArr[i], this.GroupId, this.SelfId, this.prePosInfo[i].p);
        }
        this.isDirty = false;
    }

    public lateUpdate(dt) {
        /**在update之后执行 只有rect不断变化时需要更新*/
        this.updateGridInfo();
    }
    //#endregion

    // #region ----------xz平面分割----------
    /**
     * 根据Rect包围盒分割成多个计算点 xz平面
     */
    public updatePosRecFromRect(rect: Rect, outArr: Vec3[]) {
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
    //xz平面 只计算一个点的情况 
    public updatePosRecFromPos(p: Vec3) {
        if (!this.curRectPosArr[0]) {
            this.curRectPosArr[0] = v3();
        }
        this.curRectPosArr[0].x = Math.ceil(p.x);
        this.curRectPosArr[0].y = 0;
        this.curRectPosArr[0].z = Math.ceil(p.z);
    }

    /**
     * 根据Rect包围盒分割成多个计算点 xy平面
     */
    // public updatePosRecFromRect(rect: Rect, out: Vec3[]) {
    //     const gs = CollisionManager.gridSize;
    //     const _x = Math.ceil(rect.width / gs.x);
    //     const _y = Math.ceil(rect.height / gs.y);
    //     let i = 0;
    //     for (let x = 0; x <= _x; x++) {
    //         for (let y = 0; y <= _y; y++) {
    //             if (!out[i]) {
    //                 out[i] = v3();
    //             }
    //             out[i].set(x * gs.x, y * gs.y);
    //             out[i].add3f(rect.x, rect.y, 0)
    //             i++;
    //         }
    //     }
    // }
    //#endregion

    //#region -----------xz平面碰撞检测--------
    private _tmpP0 = v3();
    private _isColX = false;
    private _isColZ = false;
    private _isColl = false;
    /**
  * 根据自身分组进行-移动阻碍检测,
  * 检测到一次碰撞后立刻结束
  * 
  * @param curPos 当前位置
  * @param step 位移增量
  * @param outPos 计算后的位置-返回
   */
    public checkMoveCollision(curPos: Vec3, step: Vec3, outPos: Vec3) {

        this._isColl = false;
        outPos.set(curPos);

        //2.分步检测
        if (step.x != 0 || step.z != 0) {
            //有位移时 x,z分步检测
            //x轴
            if (step.x != 0) {
                this._tmpP0.set(curPos.x + step.x, curPos.y, curPos.z);
                this._isColX = this.checkPosFast(this._tmpP0);
                outPos.x = this._isColX ? curPos.x : this._tmpP0.x;
            }
            //z轴
            if (step.z != 0) {
                this._tmpP0.set(curPos.x, curPos.y, curPos.z + step.z);
                this._isColZ = this.checkPosFast(this._tmpP0);
                outPos.z = this._isColZ ? curPos.z : this._tmpP0.z;
            }

            //合并XZ记录
            this._isColl = this._isColX && this._isColZ;

        } else {
            //无位移-直接检测当前坐标
            this._tmpP0.set(curPos)
            this._isColl = this.checkPosFast(this._tmpP0);
        }

        return this._isColl;
    }

    /**
     * 快速检测指定位置是否有碰撞, 主要作为触发器
     * 检测到一次碰撞后立刻结束
     */
    public checkPosFast(p: Vec3, cb?: (group: number, cldId: number) => void) {
        //1.清除记录
        for (const key in this._outRes) {
            this._outRes[key] = null;
        }
        this._outRes = {};

        // 更新位置信息
        this.setRectPos(p);
        this.updateGridInfo();

        //2.优先粗略检测
        if (CollisionTools.impreciseCheckByRect(this.GroupId, this.SelfId, this.curRectPosArr, this._outRes, true)) {
            for (const key in this._outRes) {
                const cldArr = this._outRes[key];
                //2.精细检测
                for (let i = 0; i < cldArr.length; i++) {
                    const cldId = cldArr[i];
                    if (CollisionTools.checkRectByColId(this.selfRect, cldId, null, this.isCircleCollider, true)) {
                        cb && cb(+key, cldId);
                        //返回结果
                        return true;
                    }
                }
            }
        }
        return false;
    }


    /**
     * 检测当前位置是否有碰撞,-<按照分组配置检测>
     * 并返回所有结果
     * @param curPos 
     * @param cb 
     */
    public checkPosCollistion(curPos: Vec3, cb: (out: { [groupId: number]: number[] }) => void) {
        //1.清除记录
        for (const key in this._outRes) {
            this._outRes[key] = null;
        }
        this._outRes = {};
        let isColl = this._checkPosCollison(this._tmpP0.set(curPos), this._outRes);
        isColl && cb && cb(this._outRes);
        return isColl;
    }

    private _outRes: { [groupId: number]: number[] };

    /**检测指定位置是否有碰撞 -<按照分组配置检测>
     * 返回所有结果
     * 
    */
    private _checkPosCollison(p: Vec3, outRes: { [groupId: number]: number[] }): boolean {

        //1.更新位置信息
        this.setRectPos(p);
        this.updateGridInfo();

        let colCount = 0;
        //2.优先粗略检测
        if (CollisionTools.impreciseCheckByRect(this.GroupId, this.SelfId, this.curRectPosArr, outRes, true)) {
            for (const key in outRes) {
                const cldArr = outRes[key];
                //2.精细检测
                for (let i = cldArr.length - 1; i >= 0; i--) {
                    const cldId = cldArr[i];
                    if (!CollisionTools.checkRectByColId(this.selfRect, cldId, null, this.isCircleCollider, true)) {
                        //剔除没有碰撞的cldId,
                        cldArr.splice(i, 1);
                    }
                }
                //3.移除分组
                if (cldArr.length == 0) {
                    delete outRes[key];
                } else {
                    colCount++;
                }
            }
        }

        return colCount > 0;
    }

    /**检测 <指定的分组> 的所有碰撞对象 */
    public checkPosByGroup(p: Vec3, groupArr: number[], cb: (out: { [groupId: number]: number[] }) => void): boolean {
        //1.清除记录
        for (const key in this._outRes) {
            this._outRes[key] = null;
        }
        this._outRes = {};
        // 更新位置信息
        this.setRectPos(p);
        this.updateGridInfo();

        //2.优先粗略检测
        let colCount = 0;
        if (CollisionTools.impreciseCheckByGroup(p, this._outRes, groupArr)) {
            for (const key in this._outRes) {
                const cldArr = this._outRes[key];
                //2.精细检测
                for (let i = cldArr.length - 1; i >= 0; i--) {
                    const cldId = cldArr[i];
                    if (!CollisionTools.checkRectByColId(this.selfRect, cldId, null, this.isCircleCollider, true)) {
                        //剔除没有碰撞的cldId,
                        cldArr.splice(i, 1);
                    }
                }
                //3.移除分组
                if (cldArr.length == 0) {
                    delete this._outRes[key];
                } else {
                    colCount++;
                }
            }
        }

        this._isColl = colCount > 0;
        this._isColl && cb && cb(this._outRes);
        return this._isColl;
    }

    //#endregion


}

