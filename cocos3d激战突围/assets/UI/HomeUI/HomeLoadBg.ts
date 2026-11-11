import { _decorator, Component, Node } from 'cc';
import { GlobalTmpData } from '../../Init/Config/GlobalTmpData';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
const { ccclass, property } = _decorator;

@ccclass('HomeLoadBg')
export class HomeLoadBg extends Component {

    @property(Node)
    title: Node = null;

    onEnable() {
        this.title.active = StorageSystem.getData().levelAssets.curLv == 1;
    }

}

