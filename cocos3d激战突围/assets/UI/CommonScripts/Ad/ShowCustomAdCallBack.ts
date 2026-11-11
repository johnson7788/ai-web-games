import { _decorator, Component, Node, CCInteger } from 'cc';
import EventManager from '../../../Init/Managers/EventManager';
import { EventTypes } from '../../../Init/Managers/EventTypes';
const { ccclass, property } = _decorator;
//显示原生-失败回调
@ccclass('ShowCustomAdCallBack')
export class ShowCustomAdCallBack extends Component {
    @property({ type: CCInteger, step: 1 })
    adIdArr: number[] = [];
    @property(Node)
    replaceAdArr: Node[] = [];

    onLoad() {
        this.replaceAdArr.forEach(e => { e.active = false });
    }
    onEnable() {
        this.replaceAdArr.forEach(e => { e.active = false });
        //先隐藏所有 
        EventManager.emit(EventTypes.SDKEvents.HideCustomAd);

        console.log('ShowCustomAd:');

        for (let i = 0; i < this.adIdArr.length; i++) {
            const adId = this.adIdArr[i];
            EventManager.emit(EventTypes.SDKEvents.ShowCustomAd, adId, {
                fail: () => {
                    console.log('原生显示失败,显示自定义导出',);
                    //显示自定义导出
                    if (this.replaceAdArr[i]) {
                        this.replaceAdArr[i].active = true;
                    }
                }
            });
        }
    }

    onDisable() {
        console.log('HideCustomAd:',);
        this.adIdArr.forEach(adId => {
            EventManager.emit(EventTypes.SDKEvents.HideCustomAd, adId);
        })
    }
}

