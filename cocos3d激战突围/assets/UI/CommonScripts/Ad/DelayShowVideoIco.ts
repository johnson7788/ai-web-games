import { _decorator, Component, Node, UIOpacity } from 'cc';
import { PlatformType, SDKSystem } from '../../../Init/SystemSDK/SDKSystem';
import { StorageSystem } from '../../../Init/SystemStorage/StorageSystem';
const { ccclass, property } = _decorator;

@ccclass('DelayShowVideoIco')
export class DelayShowVideoIco extends Component {

    delay = 1;

    curt = 0;
    isFinish = false;

    startLv = 1;

    uiOpacity: UIOpacity = null;

    onLoad() {
        this.uiOpacity = this.node.getComponent(UIOpacity);
        if (!this.uiOpacity) {
            this.uiOpacity = this.node.addComponent(UIOpacity);
        }
    }

    onEnable() {
        this.curt = 0;
        let lv = StorageSystem.getData().levelAssets.curLv;
        if (lv >= this.startLv &&
            SDKSystem._curPlatform == PlatformType.WXMiniGame) {
            this.isFinish = false;
            this.uiOpacity.opacity = 0;
        } else {
            this.isFinish = true;
            this.uiOpacity.opacity = 255;
        }

    }

    update(dt) {
        if (!this.isFinish) {
            this.curt += dt;
            if (this.curt >= this.delay) {
                this.isFinish = true;
                this.uiOpacity.opacity = 255;
            }
        }

    }
}

