import { _decorator, Component, Node, CCInteger } from 'cc';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;
//显示原生
@ccclass('ShowCustomAd')
export class ShowCustomAd extends Component {
    @property({ type: CCInteger, step: 1 })
    adIdArr: number[] = [];

    onEnable() {
        //先隐藏所有 
        EventManager.emit(EventTypes.SDKEvents.HideCustomAd);

        console.log('ShowCustomAd:',);
        this.adIdArr.forEach(adId => {
            EventManager.emit(EventTypes.SDKEvents.ShowCustomAd, adId);
        })
    }

    onDisable() {
        console.log('HideCustomAd:',);
        this.adIdArr.forEach(adId => {
            EventManager.emit(EventTypes.SDKEvents.HideCustomAd, adId);
        })
    }
}

