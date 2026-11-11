import { _decorator, Component, Node, size, Vec3, v3, Size } from 'cc';
import { GlobalConfig } from '../../../../Init/Config/GlobalConfig';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import EventManager from '../../../../Init/Managers/EventManager';
import { EventTypes } from '../../../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

@ccclass('EndMark')
export class EndMark extends Component {
    onLoad() {
        EventManager.on(EventTypes.CurLevelEvents.GetEndPathInfo, this.onGetEndPathInfo, this);
    }

    onEnable() {
        this.init();

    }

    onDisable() {
        this.reset();
    }

    init() {
        setTimeout(() => {
            GlobalTmpData.Player.endMarkPos.set(this.node.worldPosition);
            GlobalTmpData.endPassPath = [];
            this.getEndPaths(GlobalTmpData.endPassPath);
        }, 0);
        //test
        // let arr: Vec3[] = [];
        // this.getFormation(20, arr);
        // for (let i = 0; i < arr.length; i++) {
        //     const p = arr[i];
        //     let e = GlobalPool.get('testMark');
        //     e.parent = this.node;
        //     e.setWorldPosition(p);
        //     e.setScale(0.4, 1, 0.4);
        // }
    }

    reset() {
    }

    tmpP = v3();
    //#region -------------阵型--------------
    //获取最后的移动路径
    getEndPaths(out: Vec3[]) {
        out.push(this.node.getChildByName('p0').worldPosition);
        out.push(this.node.getChildByName('p1').worldPosition);
    }
    //获取阵型位置
    getFormation(num: number, out: Vec3[]) {
        let fNode = this.node.getChildByName('formation');
        let xNum = 10; //水平个数
        let xWitdh = 8; //排列宽度

        this.tmpP.set(fNode.worldPosition);
        this.tmpP.x += -xWitdh * 0.5;
        let stepX = xWitdh / (xNum - 1);
        let _xCount = 0;
        let _zCount = 0;

        for (let i = 0; i < num; i++) {
            let p = v3(this.tmpP);
            p.x += _xCount * stepX;
            p.z += _zCount * stepX;
            out.push(p);
            _xCount++;
            if (_xCount >= xNum) {
                _xCount = 0;
                _zCount++;
            }

        }
    }

    //#endregion

    //#region -------------事件--------------
    //获取信息
    onGetEndPathInfo(d: { num: number, outPaths, outFormation }) {
        this.getEndPaths(d.outPaths);
        this.getFormation(d.num, d.outFormation);
    }
    //#endregion
}

