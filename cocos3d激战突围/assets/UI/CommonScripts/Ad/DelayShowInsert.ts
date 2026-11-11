import { _decorator, Component, Node, Enum } from 'cc';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
import { PlatformType, SDKSystem } from '../../../Init/SystemSDK/SDKSystem';
const { ccclass, property } = _decorator;
/**--插屏广告-- */
@ccclass('DelayShowInsert')
export class DelayShowInsert extends Component {
    @property
    delay = 1;

    @property({ type: Enum(PlatformType) })
    platformType: PlatformType = PlatformType.WXMiniGame;

    curt = 0;
    isFinish = false;

    onEnable() {
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
                EventManager.emit(EventTypes.SDKEvents.ShowInsertAd);
            }
        }

    }
}

