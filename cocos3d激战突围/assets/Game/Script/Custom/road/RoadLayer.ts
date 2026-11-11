import { _decorator, Component, Node, Vec3, v3, v2, quat, Quat } from 'cc';
import { PathInfo } from '../../../../Init/Config/GlobalClass';
import { GlobalConfig } from '../../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
import { LevelDataTmp } from '../../../../Init/SystemStorage/StorageTemp';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
import { BasicLayer } from '../../Common/Basic/BasicLayer';
import { PathBasic } from './PathBasic';
const { ccclass, property } = _decorator;

@ccclass('RoadLayer')
export class RoadLayer extends BasicLayer {
    // #region -------------------------------层级生命周期------------
    /**初始化 只执行一次*/
    protected init() {

    };
    /**注册通过自定义事件管理器管理的事件  */
    protected onEvents() {

    };
    /**设置状态、数据等, */
    public setData(data?: any) {
        this.setPath(data);
    };
    /**重置状态、数据等，子类实现 ,注销事件*/
    public reset() {
        this.resetPath();

    }
    //游戏中 update
    public customUpdate(dt: number) {
        this.updatePath(dt);
    }
    public customLateUpdate(dt: number) {

    }
    // #endregion

    private tmpP = v3();
    private tmpR = v3();

    //#region --------------路段创建-------------
    public allPathRec: PathBasic[] = null;
    public allBuilding: { pos: Vec3, rot: Quat, name: string, node: Node }[] = null;
    public buildingSize = v2(12, 12); //建筑默认大小


    public setPath(d: LevelDataTmp) {
        this.allPathRec = [];
        this.allBuilding = [];
        GlobalTmpData.PathInfo = [];
        let outMin = v3(999999, 0, 999999);
        let outMax = v3(-999999, 0, -999999);

        let pos = v3();

        for (let i = 0; i < d.path.length; i++) {
            const id = d.path[i];
            const node = GlobalPool.get(id);
            node.parent = this.node;
            node.setWorldPosition(pos);
            //
            const cmp = new PathBasic(i, node, d.enemy[i], d.prop[i]);
            cmp.init();
            cmp.getStopPos(pos);
            this.allPathRec.push(cmp);

            //记录路段信息
            let pathInfo = new PathInfo();
            pathInfo.n = id;
            pathInfo.p.set(node.worldPosition);

            for (let n = 0; n < cmp.pathNode.children.length; n++) {
                const e = cmp.pathNode.children[n];
                pathInfo.path.push(v3(e.worldPosition));
            }
            GlobalTmpData.PathInfo.push(pathInfo);
            //记录建筑位置
            for (let j = 0; j < cmp.decorate.children.length; j++) {
                const d = cmp.decorate.children[j];
                this.allBuilding.push({ pos: v3(d.worldPosition), rot: quat(d.worldRotation), name: d.name, node: null });
            }

            //计算最大最小位置
            cmp.getMinMaxPos(outMin, outMax);
        }

        //计算占用地图大小
        Vec3.subtract(GlobalTmpData.MapSize, outMax, outMin);
        Vec3.round(GlobalTmpData.MapSize, GlobalTmpData.MapSize);

        this.emit(EventTypes.GridMapEvents.CreateMapData, GlobalTmpData.MapSize);
        console.log('# mapSize:', GlobalTmpData.MapSize);

        //创建碰撞体/触发器
        for (let i = 0; i < this.allPathRec.length; i++) {
            const path = this.allPathRec[i];
            path.createColliders();
            path.createTriggers();
            path.createProps();
        }
    }

    public resetPath() {

        for (let i = 0; i < this.allPathRec.length; i++) {
            const e = this.allPathRec[i];
            e.reset();
        }
        this.allPathRec = null;

        for (let i = 0; i < this.allBuilding.length; i++) {
            const e = this.allBuilding[i];
            e.pos = null;
            e.node = null;
        }
        this.allBuilding = null;
    }

    public updatePath(dt) {
        for (let i = 0; i < this.allPathRec.length; i++) {
            const e = this.allPathRec[i];
            e && e.update(dt);
        }
        this.showBuilding();
    }

    private _normalBuiding = ['Decorate_A', 'Decorate_B', 'Decorate_C'];
    private _turnBuiding = 'Decorate_Turning';
    public showBuilding() {
        //根据玩家位置显示建筑
        const p = GlobalTmpData.Player.wpos;

        const maxX = this.buildingSize.x * 0.5 + GlobalConfig.VisibleSize.x * 0.5;
        const maxZ = this.buildingSize.y * 0.5 + GlobalConfig.VisibleSize.y * 0.5;

        for (let i = 0; i < this.allBuilding.length; i++) {
            const e = this.allBuilding[i];
            if (Math.abs(p.x - e.pos.x) <= maxX &&
                Math.abs(p.z - e.pos.z) <= maxZ) {
                if (!e.node) {
                    let name;
                    let s = 1;
                    switch (e.name) {
                        case 'Decorate':
                            name = this._normalBuiding[Math.floor(Math.random() * this._normalBuiding.length)];
                            break;
                        case 'Decorate_Turning':
                            name = this._turnBuiding;
                            s = 0.5;
                            break;
                        default:
                            break;
                    }
                    e.node = GlobalPool.get(name);
                    e.node.parent = this.node;
                    e.node.setWorldPosition(e.pos);
                    e.node.setWorldRotation(e.rot);
                }
            } else {
                GlobalPool.put(e.node);
                e.node = null;
            }
        }
    }

    //#endregion

    //#region --------------事件-----------------    


    //#endregion

}

