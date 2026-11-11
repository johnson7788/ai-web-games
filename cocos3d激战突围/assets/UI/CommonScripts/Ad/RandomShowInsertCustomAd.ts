import { _decorator, Component, Node, Enum } from 'cc';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import { PlatformType, SDKSystem } from '../../../Init/SystemSDK/SDKSystem';
const { ccclass, property } = _decorator;

@ccclass('RandomShowInsertCustomAd')
export class RandomShowInsertCustomAd extends Component {

    @property
    instertRate = 0.5;
    @property
    customAdId = 0;
    @property
    delay = 1;

    @property({ type: Enum(PlatformType) })
    platformType: PlatformType = PlatformType.WXMiniGame;

    curt = 0;
    isFinish = false;

    onEnable() {
        EventManager.emit(EventTypes.SDKEvents.HideCustomAd);

        this.isFinish = true;
        if (SDKSystem._curPlatform == this.platformType) {
            this.isFinish = false;
            this.curt = 0;
        }
    }

    update(dt) {
        if (!this.isFinish) {
            this.curt += dt;
            if (this.curt >= this.delay) {
                this.isFinish = true;
                //
                if (Math.random() < this.instertRate) {
                    EventManager.emit(EventTypes.SDKEvents.ShowInsertAd);
                } else {
                    EventManager.emit(EventTypes.SDKEvents.ShowCustomAd, this.customAdId);
                }
            }
        }
    }

    onDisable() {
        EventManager.emit(EventTypes.SDKEvents.HideCustomAd, this.customAdId);
    }
}

