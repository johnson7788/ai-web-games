import { _decorator, Component, Node } from 'cc';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;

// 原生广告改为优先拉取插屏-失败后再展示原生
@ccclass('ShowInsertCallBack')
export class ShowInsertCallBack extends Component {
    @property
    customAdId = 0;
    _isReplace = false;
    onLoad() {

    }

    onEnable() {
        this._isReplace = false;
        EventManager.emit(EventTypes.SDKEvents.HideCustomAd);

        EventManager.emit(EventTypes.SDKEvents.ShowInsertAd, {
            fail: () => {
                console.log('## 显示插屏失败 ,尝试显示原生')
                this._isReplace = true;
                EventManager.emit(EventTypes.SDKEvents.HideCustomAd);
                EventManager.emit(EventTypes.SDKEvents.ShowCustomAd, this.customAdId);
            }
        })
    }

    onDisable() {
        if (this._isReplace) {
            EventManager.emit(EventTypes.SDKEvents.HideCustomAd, this.customAdId);
        }
        this._isReplace = false;
    }
}

