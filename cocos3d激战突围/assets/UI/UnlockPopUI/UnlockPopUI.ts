import { _decorator, Component, Node, SpriteFrame, Sprite } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;

@ccclass('UnlockPopUI')
export class UnlockPopUI extends BasicUI {
    @property(Sprite)
    display: Sprite = null;
    type = 0;

    show(d?: { sf: SpriteFrame, type: number }) {
        super.show(d);
        this.display.spriteFrame = d.sf;
        this.type = d.type;
    }

    onCloseClick() {
        UISystem.hideUI(UIEnum.UnlockPopUI);
    }

    onVidoClick() {
        //观看视频
        this.emit(EventTypes.SDKEvents.ShowVideo, () => {

            StorageSystem.setData((d) => {
                //解锁
                if (d.userAssets.unlockGoods.indexOf(this.type) < 0) {
                    d.userAssets.unlockGoods.push(this.type);
                }
                //展示
                if (d.userAssets.displayGoods.indexOf(this.type) < 0) {
                    d.userAssets.displayGoods.push(this.type);
                }

                d.userAssets.chooseWeapon = this.type;
                return d;
            }, true)

            //观看视频成功
            UISystem.hideUI(UIEnum.UnlockPopUI);

        },)

    }


}

