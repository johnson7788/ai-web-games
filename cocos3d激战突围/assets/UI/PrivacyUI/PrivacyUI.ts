import { _decorator, Component, Node, Label } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('PrivacyUI')
export class PrivacyUI extends BasicUI {
    @property(Node)
    closeBtn: Node = null;
    @property(Node)
    btnLayer: Node = null;

    onLoad() {
        uniSdk.setPrivacyAgreementLabel(this.node.getChildByPath("bg/ScrollView/view/content/label1").getComponent(Label));
    }

    show(d: { isLobby: boolean }) {
        super.show();
        this.btnLayer.active = !d.isLobby;
        this.closeBtn.active = d.isLobby;
    }

    onClose() {
        UISystem.hideUI(UIEnum.PrivacyUI);
    }

    onCancel() {
        //退出游戏
        this.emit(EventTypes.SDKEvents.ExitApp);
    }
    //同意
    onConfirm() {
        UISystem.hideUI(UIEnum.PrivacyUI);
        StorageSystem.setData((d) => {
            d.userSetting.showPrivacy = false;
        }, true);

        //进入游戏
        this.emit(EventTypes.UIEvents.PrivacyConfirm);
    }
}

