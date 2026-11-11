import { _decorator, Component, Node, v3, Vec3, clamp, size, randomRange } from 'cc';
import { GlobalConfig } from '../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../Init/Config/GlobalTmpData';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import { StorageSystem } from '../../../Init/SystemStorage/StorageSystem';
import Tools from '../../../Init/Tools/Tools';
import { BasicModifyMesh } from '../Common/Basic/BasicModifyMesh';
import { BasicState } from '../Common/Basic/BasicState';
import { BasicCollider } from '../Common/VertCollison/BasicCollider';
import { ColliderGroup, CollisionManager } from '../Common/VertCollison/CollisionManager';
import { BasicRole } from './BasicRole';
import { EnemyAnim, } from './EnemyAnim';
import { EnemyDeathState, EnemyEndFollowState, EnemyEnterPassState, EnemyFollowState, EnemyMoveState, EnemyStateType, EnemyWinState } from './EnemyStates';
import { Role } from './Role';
const { ccclass, property } = _decorator;

@ccclass('Enemy')
export class Enemy extends BasicRole {
    node: Node = null;
    enemyType: GlobalEnum.EnemyType;
    anim: EnemyAnim = null;
    modfiyMsCmp: BasicModifyMesh = null;

    //
    curScale = 1;

    //#region --------------流程--------------
    init(node: Node, enemyType: GlobalEnum.EnemyType, allPath: Vec3[]) {
        this.enemyType = enemyType;
        this.node = node;
        this.modfiyMsCmp = this.node.getComponent(BasicModifyMesh);
        this.modfiyMsCmp.setData();

        this.anim = new EnemyAnim(this.node);
        this.anim.init(this);

        this.initProp();
        this.initMoveData(allPath);
        this.setStateData();
        this.setCollider();
        this.initShadow();
    }

    reset() {
        this.anim.reset();
        this.resetState();
        this.resetCollider();
        this.resetShadow();
        Tools.clearObj(this);
    }

    update(dt) {
        this.updateState(dt);
        this.updateCollider(dt);
        this.updateTransData(dt);
    }

    lateUpdate(dt) {
        this.lateUpdateCollider(dt);
    }

    //#endregion
    tmpP = v3();
    tmpR = v3();
    tmpV = v3();
    tmpC = v3();
    //#region --------设置阴影------------
    _shadowData = { pos: null, scale: 1, isShow: true };
    initShadow() {
        this._shadowData.pos = this.curPos;
        this._shadowData.isShow = true;
        this._shadowData.scale = this.curScale;
        EventManager.emit(EventTypes.EffectEvents.showMergeEffect, GlobalEnum.MergeEffectType.MergeShadow, this._shadowData);
    }

    resetShadow() {
        this._shadowData.isShow = false;
    }
    //#endregion

    //#region --------移动、旋转--------------
    //当前自身的移动方向
    lineVec = v3();
    //路径索引
    pathIndex = 0;
    //整个路径-中心点
    allPath: Vec3[] = null;
    //线性移速
    moveSpd = 0;
    //是否移动到最后的路段
    isPathEnd = false;
    //是否碰到终点线
    isEndMark = false;

    //实际坐标
    curPos = v3();
    //-----旋转
    _rotVec = v3();
    //目标弧度
    _toRadianY = 0;
    //初始弧度
    _curRadianY = 0;
    //旋转方向 
    _rotDirec = 1;
    //旋转速度
    _rotSpd = Math.PI * 1;
    //
    _rotSpdRate = 1;

    //追随目标
    _followTarget: Role = null;

    initMoveData(allPath: Vec3[]) {
        //
        this.allPath = allPath;
        this.pathIndex = 0;
        this.curPos.set(this.allPath[0]);
        //
        this.isPathEnd = false;
        this.isEndMark = false;
        this.moveSpd = GlobalConfig.Enemy[this.enemyType].spd * (Math.random() * 0.15 + 1);
        //
        this.lineVec.set(this.allPath[1]).subtract(this.allPath[0]);
        //计算初始角度
        let curRy = Math.atan2(-this.lineVec.z, this.lineVec.x) + 1.57;
        this.calRotation(curRy);
        this._curRadianY = this._toRadianY;
        this.modfiyMsCmp.setTransData(this.curPos, this._curRadianY, this.curScale);
    }

    //根据当前最终的方向移动
    move(dt) {
        //中心点移动
        this.tmpP.set(this.lineVec).multiplyScalar(dt);
        this.curPos.add(this.tmpP);
        //
        //根据当前速度方向计算旋转
        let curRy = Math.atan2(-this.lineVec.z, this.lineVec.x) + 1.57;
        this.calRotation(curRy);
        this.rotation(dt);
    }

    updateTransData(dt) {
        this.modfiyMsCmp.setTransData(this.curPos, this._curRadianY, this.curScale);
        this.modfiyMsCmp.updateColor(dt);

    }

    //计算路径方向
    calPathDirec() {
        let prePos = this.allPath[this.pathIndex];
        let nexSubId = this.pathIndex + 1;
        if (nexSubId >= this.allPath.length - 1) {
            this.isPathEnd = true;
            return;
        }
        let nextPos = this.allPath[nexSubId];
        let maxLen = this.tmpP.set(prePos).subtract(nextPos).lengthSqr();

        this.tmpP.set(this.curPos).subtract(prePos);
        let curLen = this.tmpP.lengthSqr();
        if (curLen >= maxLen) {
            //切换路线索引
            this.pathIndex++;
            // console.log('enemy change:', this.pathIndex);
            nexSubId = this.pathIndex + 1;
            if (nexSubId > this.allPath.length - 1) {
                this.isPathEnd = true;
                return;
            }
            prePos = this.allPath[this.pathIndex];
            nextPos = this.allPath[nexSubId];

        }

        //--线性速度            
        this.lineVec.set(nextPos).subtract(prePos).normalize().
            multiplyScalar(this.moveSpd);

    }

    //旋转
    rotation(dt) {
        if (this._curRadianY !== this._toRadianY) {
            let step = this._rotSpd * this._rotSpdRate * dt;
            if (step > Math.abs(this._curRadianY - this._toRadianY)) {
                this._curRadianY = this._toRadianY;
            } else {
                step *= this._rotDirec;
                this._curRadianY += step;
            }
            this._rotVec.set(0, this._curRadianY * 57.3, 0);
        }
    }

    //根据目标旋转角度计算出旋转方式-弧度计算
    calRotation(r: number) {
        this._toRadianY = r % 6.28;
        //1.0 将当前角色角度+目标角度转换到360之内-弧度计算
        const pi = Math.PI;
        if (this._toRadianY < 0) {
            this._toRadianY += pi * 2;
        }
        this._curRadianY = this._curRadianY % (pi * 2);
        if (this._curRadianY > pi * 2) {
            this._toRadianY -= pi * 2;
        } else if (this._curRadianY < 0) {
            this._toRadianY += pi * 2;
        }
        //2.0 判断差值范围
        let sub = this._toRadianY - this._curRadianY;
        if (sub > pi) {
            //反向
            this._curRadianY += pi * 2;
            this._rotDirec = -1;
        } else if (sub < -pi) {
            //反向
            this._toRadianY += pi * 2;
            this._rotDirec = 1;
        } else if (sub > 0) {
            this._rotDirec = 1;
        } else if (sub < 0) {
            this._rotDirec = -1;
        }
    }
    //#endregion

    //#region --------行为检测-----------
    setFollowTarget(t: Role) {
        this._followTarget = t;
        if (this._followTarget) {
            this.changeState(EnemyStateType.Follow);
        }
    }

    _checkCd = 0.2;
    _checkTime = 0;
    //检测玩家中心距离
    checkPlayerCenterPos(dt) {
        this._checkTime += dt;
        if (this._checkTime >= this._checkCd) {
            this._checkTime = 0;
            //
            const wp = GlobalTmpData.Player.wpos;
            const followDist = GlobalConfig.EnemyCfg.followDist;
            let curLen = this.tmpP.set(wp).subtract(this.curPos).lengthSqr();
            if (curLen <= followDist * followDist) {
                this.changeState(EnemyStateType.Follow);
            }
        }
    }

    //检测终点线
    checkEndMark() {
        const emp = GlobalTmpData.Player.endMarkPos;
        if (!this.isEndMark && Math.abs(this.curPos.x - emp.x) < 5 &&
            this.curPos.z > emp.z - 0.5) {
            this.isEndMark = true;
            //
            this.changeState(EnemyStateType.EnterPass);
        }
    }
    //#endregion

    //#region --------碰撞检测-----------
    collider: BasicCollider<Enemy> = null;
    setCollider() {
        let r = GlobalConfig.EnemyCfg.cldRadius;
        this.collider = new BasicCollider<Enemy>(ColliderGroup.Enemy, this, true);
        this.collider.setRectSize(size(r, r));
        this.collider.setRectPos(this.curPos);
        this.collider.updateGridInfo(true);
        this.collider.isCircleCollider = true;
    }

    resetCollider() {
        if (this.collider) {
            this.collider.clearGridInfo();
            this.collider.removeFromManager();
            this.collider = null;
        }
    }

    updateCollider(dt) {
        this.collider && this.collider.setRectPos(this.curPos);
    }

    lateUpdateCollider(dt) {
        this.collider && this.collider.lateUpdate(dt);
    }
    //#endregion

    //#region --------攻击/受击--------------
    hp = 0;
    atk = 0;
    initProp() {
        let lv = StorageSystem.getData().levelAssets.curLv;
        let rate = (lv * GlobalConfig.EnemyCfg.lvupStep + 1);
        const cfg = GlobalConfig.Enemy[this.enemyType];
        this.hp = cfg.hp * rate;
        this.atk = cfg.atk * rate;
        this.curScale = cfg.scale;
    }

    onAtk() {
    }

    byHit(n: number) {
        if (this.hp <= 0) return;

        this.hp -= n;
        //击中效果
        EventManager.emit(EventTypes.EffectEvents.showMergeEffect,
            GlobalEnum.MergeEffectType.MergeEnemyByHit, { p: this.tmpP.set(this.curPos.x, 0.5, this.curPos.z) });

        this.modfiyMsCmp.byHit();

        if (this.hp <= 0) {
            this.hp = 0;
            this.resetCollider();
            this.modfiyMsCmp.setDeath();
            ///
            this.changeState(EnemyStateType.Death);
        }
    }
    //#endregion

    //#region --------状态---------
    _stateRecs: { [state: number]: BasicState<Enemy> } = {};
    public _curState: EnemyStateType = null;
    public _preState: EnemyStateType = null;

    /**设置初始状态 */
    setStateData() {
        this._stateRecs[EnemyStateType.Move] = new EnemyMoveState(this);
        this._stateRecs[EnemyStateType.Follow] = new EnemyFollowState(this);
        this._stateRecs[EnemyStateType.EnterPass] = new EnemyEnterPassState(this);
        this._stateRecs[EnemyStateType.EndFollow] = new EnemyEndFollowState(this);
        this._stateRecs[EnemyStateType.Death] = new EnemyDeathState(this);
        this._stateRecs[EnemyStateType.Win] = new EnemyWinState(this);

        this.changeState(EnemyStateType.Move);
        setTimeout(() => {
        }, 0);
    }
    /**重置状态 */
    resetState() {
        for (const key in this._stateRecs) {
            this._stateRecs[key].offEvents();
            this._stateRecs[key].reset();
        }
        this._stateRecs = {};
        this._curState = null;
        this._preState = null;
    }
    /**
    * 切换状态
    * @param state 
    * @param enterData 传入参数
    * @param isForth 是否强制切换
    * @returns 
    */
    changeState(state: EnemyStateType, enterData?, isForth = false) {

        if (this._curState === state && !isForth) return;
        // clog.log('role:', EnemyStateType[state]);
        //退出之前的状态
        if (this._stateRecs[this._curState]) {
            this._stateRecs[this._curState].exit();
        }
        //切换到新的状态
        if (this._stateRecs[state]) {
            this._preState = this._curState;
            this._curState = state;
            this._stateRecs[this._curState].enter(enterData);
        }
    }
    /**更新状态 */
    updateState(dt) {
        if (this._stateRecs[this._curState]) {
            this._stateRecs[this._curState].update(dt);
        }
    }

    //#endregion

}

