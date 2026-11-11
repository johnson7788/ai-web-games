import { _decorator, Component, Node, Layout, UIOpacity, Button } from 'cc';
import { PlatformType, SDKSystem } from '../../../Init/SystemSDK/SDKSystem';
const { ccclass, property } = _decorator;

@ccclass('WxDelayShowBtn')
export class WxDelayShowBtn extends Component {
    isDelay = false;
    @property
    delay = 1;

    delayId = null;
    uiOpacity: UIOpacity = null;
    btn: Button = null;

    onLoad() {
        this.isDelay = SDKSystem._curPlatform == PlatformType.WXMiniGame ||
            SDKSystem._curPlatform == PlatformType.PCMiniGame;

        this.btn = this.node.getComponent(Button);
        this.uiOpacity = this.node.getComponent(UIOpacity);
        if (!this.uiOpacity) {
            this.uiOpacity = this.node.addComponent(UIOpacity);
            this.uiOpacity.opacity = 255;
        }
    }

    onEnable() {
        clearTimeout(this.delayId);

        if (this.isDelay) {
            this.setEnable(false);

            this.delayId = setTimeout(() => {
                this.setEnable(true);
            }, this.delay * 1000);
        } else {
            this.setEnable(true);
        }
    }

    onDisable() {
        clearTimeout(this.delayId);
    }


    setEnable(isShow) {
        this.uiOpacity.opacity = isShow ? 255 : 0;
        this.btn.interactable = isShow;
    }
}

