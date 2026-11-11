import { _decorator, Component, Node, Vec3, v3, v2, rect, size, quat, Size, MeshRenderer } from 'cc';
import { GlobalConfig, TrapCfg } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import EventManager from '../../../../Init/Managers/EventManager';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import Tools from '../../../../Init/Tools/Tools';
import { BasicCollider } from '../../Common/VertCollison/BasicCollider';
import { ColliderGroup } from '../../Common/VertCollison/CollisionManager';
import { PropsLayer } from '../prop/PropsLayer';
const { ccclass, property } = _decorator;

@ccclass('PathBasic')
export class PathBasic {
    node: Node = null;
    pathIndex = 0;

    //固定子节点层级
    pathNode: Node = null;
    decorate: Node = null;
    enemy: Node = null;
    bornPos: Node = null;
    trigger: Node = null;
    propPos: Node = null;

    //路径模型
    roadArr: Node[] = [];
    turnArr: Node[] = [];
    turnBArr: Node[] = [];
    turnCArr: Node[] = [];
    //
    enemyData: any[] = null;
    propData: any[] = null;

    constructor(pathIndex: number, n: Node, enemyData: any[], propData: any[]) {
        this.node = n;
        this.enemyData = enemyData;
        this.propData = propData;
        this.pathIndex = pathIndex;

        this.pathNode = this.node.getChildByName('path');    //路径信息
        this.decorate = this.node.getChildByName('decorate');//装饰
        this.propPos = this.node.getChildByName('prop');   //道具标记点
        this.enemy = this.node.getChildByName('enemy');     //敌人创建信息
        this.bornPos = this.enemy.getChildByName('bornPos');//敌人出生点
        this.trigger = this.enemy.getChildByName('trigger');//敌人触发点

        //记录不同的模型路径
        for (let i = 0; i < this.node.children.length; i++) {
            const node = this.node.children[i];
            switch (node.name) {
                case 'road':
                    this.roadArr.push(node);
                    break;
                case 'turn':
                    this.turnArr.push(node);
                    break;
                case 'turnB':
                    this.turnBArr.push(node);
                    break;
                case 'turnC':
                    this.turnCArr.push(node);
                    break;
                default:
                    break;
            }
        }
    }

    init() {


    }

    reset() {
        this.resetColliders();
        Tools.clearObj(this);
    }

    update(dt) {
        this.checkTrigger();
    }

    //#region ----------获取信息-------------
    tmpP = v3();

    //获取终点
    getStopPos(out: Vec3) {
        out.set(this.pathNode.children[this.pathNode.children.length - 1].worldPosition);
    }

    //与当前路径下的包围盒xz平面比较最小最大位置
    getMinMaxPos(outMin: Vec3, outMax: Vec3) {
        const cw = 12;
        const ch = 12;

        for (let i = 0; i < this.node.children.length; i++) {
            const e = this.node.children[i];
            const ms = e.getComponent(MeshRenderer);
            if (ms) {
                const wp = e.worldPosition;
                let _minX = wp.x - cw;
                let _maxX = wp.x + cw;
                let _minZ = wp.z - ch;
                let _maxZ = wp.z + ch;
                outMin.x = Math.min(outMin.x, _minX);
                outMin.z = Math.min(outMin.z, _minZ);
                outMax.x = Math.max(outMax.x, _maxX);
                outMax.z = Math.max(outMax.z, _maxZ);
            }
        }
    }


    //#endregion

    //#region ------------创建对应的碰撞体-------------
    cldArr: BasicCollider<PathBasic>[] = [];
    cldVSize = size(0.3, 10); //栏杆大小-垂直
    cldHSize = size(10, 0.3); //栏杆大小-水平
    cldBoxSize = size(10, 10); //装饰的碰撞大小
    tmpRect = rect();
    tmpQuat = quat();
    tmpR = v3();
    roadCw = 9.25 * 0.5;

    createColliders() {
        this.createDecrateCollider();
    }

    resetColliders() {
        for (let i = 0; i < this.cldArr.length; i++) {
            const e = this.cldArr[i];
            if (e) {
                e.clearGridInfo();
                e.removeFromManager();
            }
        }
        this.cldArr = [];
    }
    //两边装饰碰撞体
    createDecrateCollider() {
        for (let i = 0; i < this.decorate.children.length; i++) {
            const e = this.decorate.children[i];
            this.tmpP.set(e.worldPosition);
            let cldL = new BasicCollider<PathBasic>(ColliderGroup.Barrier, this, false);
            cldL.setRectSize(this.cldBoxSize);
            cldL.setRectPos(this.tmpP);
            cldL.updateGridInfo(true);
            this.showTestCld(this.tmpP, this.cldBoxSize);
        }
    }

    showTestCld(p: Vec3, s: Size) {
        if (!GlobalConfig.ShowDebugCld) return;
        let e = GlobalPool.get('testCld');
        e.parent = this.node.parent;
        e.setPosition(p);
        e.setScale(s.x, 0.5, s.y);
    }
    //#endregion

    //#region ------------创建对应的触发器-------------
    isCreateEnemy = false;
    curTriggerSize = v3(1, 1);
    isUsed = false;
    createTriggers() {
        /**pathId:创建路径id : (Random:随机多条 0~5:多条路径id, All:全部), type: 敌人类型, min:最少,max：最大 */
        // this.enemyData = ['All', 0, 10, 20]; //test
        // let arr = [0, 1, 2];//test
        // this.enemyData[1] = arr[Math.floor(Math.random() * arr.length)];//test

        this.isCreateEnemy = !!this.enemyData;
        this.isUsed = false;

        if (this.isCreateEnemy) {
            //showTriggerBox
            if (GlobalConfig.ShowDebugCld) {
                let e = GlobalPool.get('testTrigger');
                e.setWorldPosition(this.trigger.worldPosition);
                e.setScale(this.curTriggerSize.x, 2, this.curTriggerSize.y);
                e.parent = this.node.parent;
            }
        }

    }

    checkTrigger() {
        if (this.isCreateEnemy && !this.isUsed) {
            this.tmpP.set(GlobalTmpData.Player.wpos).subtract(this.trigger.worldPosition);
            if (this.tmpP.lengthSqr() < 2) {
                this.createEnemys();
                this.isUsed = true;
            }
        }
    }

    //创建敌人
    createEnemys() {

        if (!this.isUsed && this.isCreateEnemy && !!this.enemyData) {
            // ['触发点Id, 敌人类型id, 最小数量, 最大数量 ']
            for (let i = 0; i < this.enemyData.length; i++) {
                const str: string = this.enemyData[i];
                let arr = str.split(',');

                //出生点Id
                let trigIdStr = arr[0];
                //类型Id
                let enemyIdStr = arr[1];
                //最小
                let min = +arr[2];
                //最大 
                let max = +arr[3];

                //路径出生点Id
                for (let n = 0; n < trigIdStr.length; n++) {
                    const _id = +trigIdStr[n];
                    //出生点
                    if (this.bornPos.children[_id]) {
                        //敌人类型
                        for (let m = 0; m < enemyIdStr.length; m++) {
                            //路径
                            let path = [];
                            this.bornPos.children[_id].children.forEach(e => {
                                path.push(v3(e.worldPosition));
                            })
                            let enemyType = +enemyIdStr[m];
                            let enemyNum = Math.floor(Math.random() * (max - min) + min);
                            enemyNum = enemyNum < 0 ? 0 : enemyNum;

                            let data = { type: enemyType, count: enemyNum, initPathIndex: this.pathIndex, initPath: path }
                            EventManager.emit(EventTypes.EnemyEvents.CreateEnemys, data);

                        }
                    }

                }
            }
        }


    }
    //#endregion

    //#region ------------创建对应的道具--------------

    createProps() {
        if (!this.propData) return;
        //道具配置 { propType: GlobalEnum.PropType, eleType: number, val: any }
        let propType = this.propData[0];
        let data = { p: this.propPos.worldPosition, r: this.propPos.worldRotation, d: undefined };
        let width = 9, stepW = 0;

        switch (propType) {
            case GlobalEnum.PropType.Weapon:
                //武器
                let count = this.propData[3].length;
                let str = this.propData[3];
                stepW = width / (count + 1);
                let wpId = PropsLayer._weaponID++;
                for (let i = 0; i < count; i++) {
                    //计算位置
                    this.tmpP.set((i + 1) * stepW - width / 2);
                    this.tmpP.transformMat4(this.propPos.worldMatrix);
                    data.p.set(this.tmpP);
                    data.d = { weaponType: +str[i], weaponId: wpId };

                    // console.log(str[i]);
                    EventManager.emit(EventTypes.CurLevelEvents.CreateProps, 'WeaponProp', data);
                }

                break;
            case GlobalEnum.PropType.Trap:
                //陷阱
                let trapType = this.propData[1];
                let name = TrapCfg[trapType].perfab;
                let num = this.propData[2] || 1;
                data.d = this.propData[3];

                const cfg = TrapCfg[trapType];
                if (!cfg.isMuilty) {
                    num = 1;
                }
                width = 9;
                stepW = width / (num + 1);
                for (let i = 0; i < num; i++) {
                    //计算位置
                    this.tmpP.set((i + 1) * stepW - width / 2);
                    this.tmpP.transformMat4(this.propPos.worldMatrix);
                    data.p.set(this.tmpP);

                    EventManager.emit(EventTypes.CurLevelEvents.CreateProps, name, data);
                }

                break;
            case GlobalEnum.PropType.Increase:
                //数量增益、减益
                let _id = PropsLayer._IncreaceID++;
                let _left = this.propData[1];
                let _right = this.propData[2];
                let isMove = this.propData[3] != 0 && (!_left || !_right);
                let lpos = v3(-2.25, 0, 0);
                let rpos = v3(2.25, 0, 0);
                if (!!_left) {
                    lpos.transformMat4(this.node.worldMatrix);
                    data.p.set(lpos);
                    this.showIncreaceProp(_left, isMove, _id, data);
                }
                if (!!_right) {
                    rpos.transformMat4(this.node.worldMatrix);
                    data.p.set(rpos);
                    this.showIncreaceProp(_right, isMove, _id, data);
                }

                break;
            default:
                break;
        }
    }
    //创建
    showIncreaceProp(str: string, isMove: boolean, id: number, data) {
        let _symbol = str[0];
        let _str = str;
        _str = _str.slice(1, _str.length);
        let _num = +_str;
        data.id = id;
        data.isMove = isMove;
        data.symbol = _symbol;
        data.num = _num;

        EventManager.emit(EventTypes.CurLevelEvents.CreateProps, 'Panels', data);
    }


    //#endregion
}

