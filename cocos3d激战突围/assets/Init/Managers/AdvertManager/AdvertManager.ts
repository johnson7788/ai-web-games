import { _decorator, Component, Node } from 'cc';
import { PlatformType, SDKSystem } from '../../SystemSDK/SDKSystem';
import EventManager from '../EventManager';
import { EventTypes } from '../EventTypes';
const { ccclass, property } = _decorator;
/**广告管理 */
@ccclass('AdvertManager')
export class AdvertManager extends Component {
    @property
    testBanner = false;

    onLoad() {
        this.onEvents();
    }

    onEvents() {
        EventManager.on(EventTypes.SDKEvents.ShowBanner, this.onShowBanner, this);
        EventManager.on(EventTypes.SDKEvents.HideBanner, this.onHideBanner, this);
    }

    onShowBanner() {
        console.warn("AdvertManager.onShowBanner");
        this.onShowTestBanner(true);
    }
    onHideBanner() {
        console.warn("AdvertManager.onHideBanner");
        this.onShowTestBanner(false);
    }
    //只在PC上显示
    onShowTestBanner(isShow) {
        this.node.children[0].active =
            SDKSystem._curPlatform == PlatformType.PCMiniGame &&
            this.testBanner && isShow;
    }



}
