import { _decorator, Component, Node } from 'cc';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;
/**--原生广告-- */
@ccclass('DelayShowCustom')
export class DelayShowCustom extends Component {
    @property
    delay = 1;

    @property
    customAdId = 0;

    curt = 0;
    isFinish = false;


    onEnable() {
        EventManager.emit(EventTypes.SDKEvents.HideCustomAd);
        this.isFinish = false;
        this.curt = 0;
    }

    update(dt) {
        if (!this.isFinish) {
            this.curt += dt;
            if (this.curt >= this.delay) {
                this.isFinish = true;
                EventManager.emit(EventTypes.SDKEvents.ShowCustomAd, 0);
            }
        }
    }
}

