import { _decorator, Component, Node, Label } from 'cc';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import Tools from '../../Init/Tools/Tools';
const { ccclass, property } = _decorator;

@ccclass('CheckTimeCmp')
export class CheckTimeCmp extends Component {

    @property(Label)
    minLabel: Label = null;
    @property(Label)
    scendLabel: Label = null;

    @property(Node)
    timeInfo: Node = null;
    @property(Node)
    maxTip: Node = null;

    //上次记录的时间
    lastTime = 0;
    //剩余时间
    restTime = 0;
    //cd /s
    cd = GlobalConfig.Award.recoverTime;
    //
    isMax = false;

    onEnable() {
        //test
        // StorageSystem.setData((d) => {
        //     // d.userAssets.asset = 8;
        //     d.userAssets.lastRecoverTime = Date.now() - 50 * 1000;
        // }, true)

        let data = StorageSystem.getData().userAssets;
        this.lastTime = data.lastRecoverTime; //ms

        let curt = Date.now();
        let subt = curt - data.lastRecoverTime;

        //判断时间间隔
        let subSecend = Math.floor(subt / 1000);
        let addEnergy = Math.floor(subSecend / GlobalConfig.Award.recoverTime);
        this.restTime = GlobalConfig.Award.recoverTime - subSecend % GlobalConfig.Award.recoverTime;

        //记录
        this.addEnergy(addEnergy);

        let curEnergy = data.asset;
        this.isMax = curEnergy >= GlobalConfig.Award.max;

        this.timeInfo.active = !this.isMax;
        this.maxTip.active = this.isMax;
        //
        this.restTime = this.isMax ? GlobalConfig.Award.recoverTime : this.restTime;

    }

    timeData = { min: '00', scend: '00' };
    checkTime(dt) {
        this.isMax = StorageSystem.getData().userAssets.asset >= GlobalConfig.Award.max;
        if (this.isMax) {
            this.restTime = GlobalConfig.Award.recoverTime;
            this.timeInfo.active = false;
            this.maxTip.active = true;
        } else {
            this.timeInfo.active = true;
            this.maxTip.active = false;

            this.restTime -= dt;
            if (this.restTime <= 0) {
                //增加体力
                this.addEnergy(GlobalConfig.Award.addStep, true,);
                this.restTime = GlobalConfig.Award.recoverTime;
            }
            //
            Tools.getMinByScend(this.restTime, this.timeData);
            this.minLabel.string = this.timeData.min;
            this.scendLabel.string = this.timeData.scend;
        }
    }


    update(dt) {
        this.checkTime(dt);
    }

    addEnergy(n, isLimit = true,) {
        n = n < 0 ? 0 : n;
        if (n == 0) return;
        StorageSystem.setData((d) => {
            let asset = d.userAssets.asset + n;
            if (isLimit) {
                d.userAssets.asset = asset > GlobalConfig.Award.max ?
                    GlobalConfig.Award.max : asset;
            } else {
                d.userAssets.asset = asset;
            }
            d.userAssets.lastRecoverTime = Date.now();
        }, true);
        StorageSystem.updateToAssets(false, false);
    }


}

