import { _decorator, Component, Node, Camera, Label, v3 } from 'cc';
import GlobalData from '../../Init/Config/GlobalData';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import { GlobalTmpData } from '../../Init/Config/GlobalTmpData';
const { ccclass, property } = _decorator;

@ccclass('RoleInfoCmp')
export class RoleInfoCmp extends Component {
    cameraUI: Camera = null;
    @property(Label)
    roleLabel: Label = null;

    onEnable() {
        this.cameraUI = GlobalData.get(GlobalEnum.GlobalDataType.Camera3D);

    }

    update(dt) {
        this.setRoleInfo();
    }
    tmpP = v3();
    setRoleInfo() {
        if (GlobalTmpData.Player.isPathEnd) {
            this.tmpP.set(GlobalTmpData.Player.wpos);
        } else {
            this.tmpP.set(GlobalTmpData.Player.wpos).add(GlobalTmpData.Player.offset);
        }

        this.tmpP.y += 3;
        this.cameraUI.convertToUINode(this.tmpP, this.node, this.tmpP);
        this.roleLabel.string = GlobalTmpData.normalRoleNum.toFixed(0);
        this.roleLabel.node.setPosition(this.tmpP);
    }

}

