import { _decorator, Component, Node, Sprite, SpriteFrame, Label } from 'cc';
import { BasicComponet } from '../../Init/Basic/BasicComponet';
const { ccclass, property } = _decorator;

@ccclass('customGrid1X1')
export class customGrid1X1 extends BasicComponet {

    @property(Sprite)
    sp: Sprite = null;

    @property(Label)
    nameLabel: Label = null;

    adItemData = null;
    //刷新时间
    changeTime = 10;
    curt = 0;

    onLoad() {
        this.node.on(Node.EventType.TOUCH_START, this.onClick, this);
    }

    setData(adItemData: uniSdk.AdItemData) {
        this.adItemData = adItemData;
        this.sp.spriteFrame = SpriteFrame.createWithImage(adItemData.imageAsset);
        this.nameLabel.string = this.adItemData.title;
    }

    onClick() {
        // 导出操作
        if (this.adItemData) {
            uniSdk.navigateToMiniProgram(this.adItemData, (result: boolean, data: any) => {
                if (result) console.log("导出成功", data);
                else console.log("导出失败", data);
            }, this);
        }
    }
    update(dt) {
        this.freshAd(dt);

    }

    freshAd(dt) {
        this.curt += dt;
        if (this.curt >= this.changeTime) {
            this.curt = 0;
            const itemList: uniSdk.AdItemData[] = uniSdk.Global.adItemDataList;
            //刷新
            let item = itemList[Math.floor(Math.random() * itemList.length)];
            item && this.setData(item);
        }
    }
}

