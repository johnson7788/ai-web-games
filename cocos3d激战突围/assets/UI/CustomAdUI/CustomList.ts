import { _decorator, Component, Node, Prefab, setDisplayStats, instantiate, Vec2, Vec3, Layout } from 'cc';
import { BasicComponet } from '../../Init/Basic/BasicComponet';
import GlobalPool from '../../Init/Tools/GlobalPool';
import { WXCustomADType } from './CustomAdUI';
const { ccclass, property } = _decorator;

@ccclass('CustomList')
export class CustomList extends BasicComponet {

    setData(adItemDataArr: uniSdk.AdItemData[]) {
        GlobalPool.putAllChildren(this.node);
        for (let i = 0; i < adItemDataArr.length; i++) {
            let e = GlobalPool.get(WXCustomADType.customGrid1X1, adItemDataArr[i]);
            e.parent = this.node;
            e.setPosition(Vec3.ZERO);
        }
    }

    onEnable() {
        let layout = this.node.getComponent(Layout);
        layout && layout.updateLayout();
    }

    reset() {
        GlobalPool.putAllChildren(this.node);
    }

}

