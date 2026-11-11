import { _decorator, Component, Node, Label, Vec3, v3 } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
import { AssetAnimCmp } from './AssetAnimCmp';
const { ccclass, property } = _decorator;

@ccclass('PlayerAssetsUI')
export class PlayerAssetsUI extends BasicUI {

    @property(Label)
    protected assetLabel: Label = null;
    @property(AssetAnimCmp)
    protected animCmp: AssetAnimCmp = null;
    @property(Node)
    protected animTarget: Node = null;
    @property(Node)
    protected unit: Node = null;

    protected onEvents() {
        this.on(EventTypes.GameEvents.UserAssetsChanged, this.onUserAssetsChanged, this);
    }

    public show(d?) {
        super.show(d);
        this.setAssetInfo();
    }

    // #region ----------------私有方法---------
    /**显示资源数据 */
    private setAssetInfo() {
        let asset = StorageSystem.getData().userAssets.asset;
        //test
        // asset = 99990;
        this.unit.children.forEach(e => { e.active = false });
        let num = 0;
        //单位换算
        if (asset < 10000) {
            num = asset;
        } else if (asset < 100000) {    //K
            num = Math.floor(asset / 1000);
            this.unit.getChildByName('K').active = true;
        } else if (asset < 100000) {    //M
            num = Math.floor(asset / 10000);
            this.unit.getChildByName('M').active = true;
        } else if (asset < 1000000) {   //G
            num = Math.floor(asset / 100000);
            this.unit.getChildByName('G').active = true;
        }

        this.assetLabel.string = num.toFixed(0);
    }
    // #endregion

    // #region -----------------事件-------------------
    private tmpP = v3();
    /**资产变更后 UI同步显示 */
    protected onUserAssetsChanged(isAnim = false, isMask = true) {
        if (isAnim) {
            this.tmpP.set(this.animTarget.position).add(this.animTarget.parent.position);
            this.animCmp.showAnim(Vec3.ZERO, this.tmpP, isMask, () => {
                this.setAssetInfo();
            })
        } else {
            this.setAssetInfo();
        }
    }

    // #endregion

    //#region -----------------按钮----------------
    protected onAddGoldBtnClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        UISystem.showUI(UIEnum.FreeGoldUI);
    }

    //#endregion
}

