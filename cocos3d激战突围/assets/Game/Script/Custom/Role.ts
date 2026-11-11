import { _decorator, Component, Node, Vec3, v3, size, MeshRenderer, Camera } from 'cc';
import { GlobalConfig, WeaponCfg } from '../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../Init/Config/GlobalTmpData';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import { AudioEnum } from '../../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../../Init/SystemAudio/AudioSystem';
import Tools from '../../../Init/Tools/Tools';
import { BasicModifyMesh } from '../Common/Basic/BasicModifyMesh';
import { BasicState } from '../Common/Basic/BasicState';
import { BasicCollider } from '../Common/VertCollison/BasicCollider';
import { ColliderGroup, CollisionManager, CollisionTools } from '../Common/VertCollison/CollisionManager';
import { BasicRole } from './BasicRole';
import { Enemy } from './Enemy';
import { RoleAnim } from './RoleAnim';
import { RoleHand } from './RoleHand';
import { RoleDeathState, RoleIdleState, RoleMoveState, RolePassState, RoleStandShootState, RoleStateType, RoleWinState } from './RoleStates';
const { ccclass, property } = _decorator;
//我方控制的角色
@ccclass('Role')
export class Role extends BasicRole {
    node: Node = null;
    roleAnim: RoleAnim = null;
    roleHand: RoleHand = null;
    modfiyMsCmp: BasicModifyMesh = null;

    //阵型相对位置
    offset = v3();
    //
    followPos = GlobalTmpData.Player.wpos;
    //未左右偏移的位置
    centerPos = v3();
    //当前位置
    curPos = v3();

    //所处路段的方向
    pathLineVec: Vec3 = null;
    //当前自身的移动方向
    lineVec = v3();
    //-------属性------
    hp = 0;
    //
    moveSpd = 0;
    //
    atkRate = 1;
    //当前武器
    curWeapon: GlobalEnum.WeaponType = 0;
    //
    curScale = 1;
    //-----巨人-属性
    isGiant = false;
    curGiantLv = 1;


    //#region --------流程---------

    init(node: Node, initPos: Vec3, offset: Vec3, pathLineVec, isGiant) {
        this.isGiant = isGiant;
        this.node = node;
        this.modfiyMsCmp = this.node.getComponent(BasicModifyMesh);
        this.modfiyMsCmp.setData();

        this.offset.set(offset);
        this.pathLineVec = pathLineVec;

        this.centerPos.set(initPos);
        this.curPos.set(initPos);

        this.roleAnim = new RoleAnim(this.node);
        this.roleAnim.init(this);

        this.initProp();

        this.roleHand = this.node.getComponent(RoleHand);
        this.roleHand.init(this.node.parent, this.curPos, this._rotVec, this.curScale);
        this.roleHand.setWeapon(this.curWeapon);

        this.initMoveData();
        this.setStateData();
        this.setCollider();
        this.initShadow();
    }

    reset() {
        this.roleAnim.reset();
        this.resetState();
        this.resetCollider();
        this.roleHand.reset();
        this.resetShadow();
        Tools.clearObj(this);
    }

    update(dt) {
        if (!this.roleHand) debugger
        this.roleHand.updateAnim(dt);
        this.updateTransData(dt);
        this.updateState(dt);
        this.updateCollider(dt);
    }
    lateUpdate(dt) {
        this.lateUpdateCollider(dt);
    }

    //#endregion

    //#region --------设置属性----------
    initProp() {
        const cfg = GlobalConfig.Player;
        this.hp = this.isGiant ? cfg.giantHp : cfg.hp;
        this.curScale = this.isGiant ? cfg.giantScale : cfg.scale;
        this.atkRate = this.isGiant ? cfg.giantAtkRate : cfg.atkRate;
    }

    //设置巨人等级
    setGiantLv(n) {
        if (!this.isGiant) return;
        this.curGiantLv = n;
        //设置巨人等级的表现

    }

    //#endregion

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

    //#region --------设置武器-------
    setWeapon(t) {
        if (this.curWeapon != t) {
            this.roleHand.setWeapon(t);
            this.curWeapon = t;
            //切换攻击动作
            if (GlobalTmpData.Game.isGameRun) {
                this.playAtkAnim(this.isStand, true);
            }
        }
    }
    //#endregion

    //#region --------移动/旋转---------
    tmpP = v3();
    tmpV = v3();
    stepP = v3();
    //-----旋转
    _rotVec = v3();
    //目标弧度
    _toRadianY = 0;
    //初始弧度
    _curRadianY = 0;
    //旋转方向 
    _rotDirec = 1;
    //旋转速度
    _rotSpd = Math.PI * 2;
    //

    initMoveData() {
        this.moveSpd = GlobalConfig.Player.moveSpd;
        this._curRadianY = Math.PI;
        this._toRadianY = this._curRadianY;
        this._rotVec.set(0, this._curRadianY, 0);
        this.modfiyMsCmp.setTransData(this.curPos, this._curRadianY, this.curScale);
    }

    setOffset(o) {
        this.offset.set(o);
    }
    //正常移动
    move(dt) {
        //---计算当前移动速度
        //1.路段总速度
        //2.往偏移方向的速度
        //相对追随点的偏移位置
        this.tmpP.set(this.centerPos).subtract(this.followPos);
        this.tmpV.set(this.offset).subtract(this.tmpP);
        this.tmpV.multiplyScalar(5);

        //合速度
        this.lineVec.set(this.pathLineVec).add(this.tmpV);
        //位移
        this.stepP.set(this.lineVec).multiplyScalar(dt);
        //检测
        this.centerPos.add(this.stepP);
        //偏移
        this.tmpP.set(this.centerPos).add(GlobalTmpData.Player.offset);

        //最终位移增量
        this.stepP.set(this.tmpP).subtract(this.curPos);

        //3.移动碰撞限制
        this.checkMove(this.curPos, this.stepP, this.curPos);
    }


    tmpR = v3();
    //旋转
    rotation(dt) {
        //根据当前速度方向计算旋转
        let curRy = (Math.atan2(-this.lineVec.z, this.lineVec.x) + 1.57 + 3.14);
        this.calRotation(curRy);

        if (this._curRadianY !== this._toRadianY) {
            let step = this._rotSpd * dt;
            if (step > Math.abs(this._curRadianY - this._toRadianY)) {
                this._curRadianY = this._toRadianY;
            } else {
                step *= this._rotDirec;
                this._curRadianY += step;
            }
            this._rotVec.set(0, this._curRadianY, 0);
        }

    }
    transData = [0, 0, 0, 0];
    updateTransData(dt) {
        //同步位置
        this.modfiyMsCmp.setTransData(this.curPos, this._curRadianY, this.curScale);
        this.modfiyMsCmp.updateColor(dt);
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

    //#region --------碰撞检测-----------
    collider: BasicCollider<Role> = null;
    setCollider() {
        let r = GlobalConfig.Player.cldRadius;
        this.collider = new BasicCollider<Role>(ColliderGroup.Player, this, false);
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
    //移动限制检测
    checkMove(curPos: Vec3, step: Vec3, outPos: Vec3) {
        this.collider && this.collider.checkMoveCollision(curPos, step, outPos);
    }
    _checkRes: { [groupId: number]: number[] } = {};
    _colGroup = [ColliderGroup.Enemy];
    //碰撞检测
    checkCollsion() {
        this.collider && this.collider.checkPosByGroup(this.curPos, this._colGroup, this.onCheckColliderCb.bind(this));
        // this.collider && this.collider.checkPosCollistion(this.curPos, this.onCheckColliderCb.bind(this));
    }

    //碰撞检测回调
    onCheckColliderCb(out: { [groupId: number]: number[] }) {
        let enemyAtk = 0;
        //检测敌人
        for (const key in out) {
            const arr = out[key];
            const groupId = +key;

            switch (groupId) {
                case ColliderGroup.Enemy:
                    for (let i = 0; i < arr.length; i++) {
                        const cld = arr[i];
                        const enemy = CollisionManager.getColilderByColId(cld).targetCmp as Enemy;
                        if (enemy && enemy.hp > 0) {
                            enemyAtk = enemy.atk;
                            //敌人直接死亡
                            enemy.byHit(enemy.hp);
                            //自身受到攻击
                            this.byHit(enemyAtk);
                            break;
                        }
                    }
                    break;
                default:
                    break;
            }
        }


    }

    updateCollider(dt) {
        this.checkCollsion();
    }

    lateUpdateCollider(dt) {
        this.collider && this.collider.lateUpdate(dt);
    }
    //#endregion

    //#region --------攻击/属性-----------
    atkData = { pos: v3(), rot: v3(), lineVec: v3(), rotSpd: v3(), atkRate: 1 };
    shotBulletRot = [-3, 0, 3];
    //根据当前的武器来发射子弹
    onAtk() {
        const wpCfg = WeaponCfg[this.curWeapon];
        //获取朝向        
        let rotY = this._rotVec.y - 1.57;
        switch (this.curWeapon) {

            case GlobalEnum.WeaponType.Shotgun:
                //散弹
                for (let i = 0; i < this.shotBulletRot.length; i++) {
                    const r = this.shotBulletRot[i] * 0.01745;
                    //
                    this.tmpV.set(1, 0, 0);
                    Vec3.rotateY(this.tmpV, this.tmpV, Vec3.ZERO, rotY + r);
                    this.tmpV.multiplyScalar(wpCfg.bulletSpd);

                    this.tmpP.set(this.curPos).add3f(0, 0.5, 0);

                    this.atkData.pos.set(this.tmpP);
                    this.atkData.lineVec.set(this.tmpV);
                    this.atkData.rotSpd.set(Vec3.ZERO);
                    this.atkData.atkRate = this.atkRate; //攻击加成比例
                    //子弹类型
                    EventManager.emit(EventTypes.EffectEvents.showMergeEffect, wpCfg.bullet, this.atkData);
                }
                break;

            case GlobalEnum.WeaponType.Grenades:
                //直线
                this.tmpV.set(1, 0, 0);
                Vec3.rotateY(this.tmpV, this.tmpV, Vec3.ZERO, rotY);
                this.tmpV.multiplyScalar(wpCfg.bulletSpd);

                this.tmpP.set(this.curPos).add3f(0, 0.5, 0);

                this.atkData.pos.set(this.tmpP);
                this.atkData.lineVec.set(this.tmpV);
                this.atkData.rotSpd.set(Vec3.ZERO);
                this.atkData.atkRate = this.atkRate; //攻击加成比例

                EventManager.emit(EventTypes.EffectEvents.showObjs, GlobalEnum.ThrowBullets.grenadesThrow, this.atkData);
                break;

            default:
                //直线
                this.tmpV.set(1, 0, 0);
                Vec3.rotateY(this.tmpV, this.tmpV, Vec3.ZERO, rotY);
                this.tmpV.multiplyScalar(wpCfg.bulletSpd);

                this.tmpP.set(this.curPos).add3f(0, 0.5, 0);

                this.atkData.pos.set(this.tmpP);
                this.atkData.lineVec.set(this.tmpV);
                this.atkData.rotSpd.set(Vec3.ZERO);
                this.atkData.atkRate = this.atkRate; //攻击加成比例
                //子弹类型
                EventManager.emit(EventTypes.EffectEvents.showMergeEffect, wpCfg.bullet, this.atkData);
                break;
        }
        // return;
        //音效


    }
    byHit(n) {
        if (this.hp <= 0) return;
        // 击中效果
        this.modfiyMsCmp.byHit();

        this.hp -= n;
        if (this.hp <= 0) {
            this.hp = 0;
            this.resetCollider();
            //
            this.changeState(RoleStateType.Death);
        }

    }
    //#endregion    

    //#region --------动画-----------
    isStand = false;
    playAtkAnim(isStand: boolean, isForth = true) {
        this.isStand = isStand;
        //根据当前武器播放对应的动作
        let clip = isStand ? GlobalEnum.PlayerClip.standShoot : GlobalEnum.PlayerClip.shootBack;
        if (isStand) {
            //静止
            if (this.curWeapon == GlobalEnum.WeaponType.Grenades) {
                //投掷
                clip = GlobalEnum.PlayerClip.throwStand;
            } else {
                //射击
                clip = GlobalEnum.PlayerClip.standShoot;
            }
        } else {
            //移动
            if (this.curWeapon == GlobalEnum.WeaponType.Grenades) {
                //投掷
                clip = GlobalEnum.PlayerClip.throwBack;
            } else {
                //射击
                clip = GlobalEnum.PlayerClip.shootBack;
            }
        }


        const wpCfg = WeaponCfg[this.curWeapon];
        let spd = wpCfg.atkSpd;
        this.roleAnim.playAnim(clip, true, isForth, spd);
    }
    //#endregion

    //#region --------状态---------
    _stateRecs: { [state: number]: BasicState<Role> } = {};
    public _curState: RoleStateType = null;
    public _preState: RoleStateType = null;

    /**设置初始状态 */
    setStateData() {
        this._stateRecs[RoleStateType.Idle] = new RoleIdleState(this);
        this._stateRecs[RoleStateType.Move] = new RoleMoveState(this);
        this._stateRecs[RoleStateType.Pass] = new RolePassState(this);
        this._stateRecs[RoleStateType.Death] = new RoleDeathState(this);
        this._stateRecs[RoleStateType.StandShoot] = new RoleStandShootState(this);
        this._stateRecs[RoleStateType.Win] = new RoleWinState(this);

        this.changeState(GlobalTmpData.Game.isGameRun ? RoleStateType.Move : RoleStateType.Idle);
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
    changeState(state: RoleStateType, enterData?, isForth = false) {

        if (this._curState === state && !isForth) return;
        // clog.log('role:', RoleStateType[state]);
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
