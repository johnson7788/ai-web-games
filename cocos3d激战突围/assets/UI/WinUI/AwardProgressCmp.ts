import { _decorator, Component, Node, SpriteFrame, Sprite, UIOpacity, clamp01, Label } from 'cc';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
import Loader from '../../Init/Tools/Loader';
const { ccclass, property } = _decorator;

/**奖励进度 */
@ccclass('AwardProgressCmp')
export class AwardProgressCmp extends Component {
    @property(UIOpacity)
    uiOpacity: UIOpacity = null;

    @property(Sprite)
    sp: Sprite = null;
    @property(Sprite)
    maskSp: Sprite = null;
    @property(Label)
    rateLabel: Label = null;

    onEnable() {
        this.loadRes(() => {
            this.checkAward();
        })
    }

    checkAward() {
        let userAssets = StorageSystem.getData().userAssets
        if (userAssets.unlockLvRec.curId <= 0) {
            //没有奖励了
            this.uiOpacity.opacity = 0;
            return;
        }
        let curId = userAssets.unlockLvRec.curId;
        let curLv = userAssets.unlockLvRec.curLv + 1;

        //设置图片
        this.sp.spriteFrame = this.assets[curId];
        this.maskSp.spriteFrame = this.assets[curId];

        this.uiOpacity.opacity = 255;
        const cfg = GlobalConfig.AwardCfg;

        let curRate = curLv / cfg[curId].lv;

        this.maskSp.fillRange = 1 - curRate;

        this.rateLabel.string = (curRate * 100).toFixed(0);
        //记录+1
        userAssets.unlockLvRec.curLv = curLv;
        StorageSystem.saveData();

        if (curLv >= cfg[curId].lv) {
            //切换解锁id
            const cfg = GlobalConfig.AwardCfg;
            userAssets.unlockLvRec.curId = -1;
            userAssets.unlockLvRec.curLv = 0;
            //记录
            StorageSystem.setData((d) => {
                if (d.userAssets.displayGoods.indexOf(curId) < 0) {
                    d.userAssets.displayGoods.push(curId);
                }
                return d;
            }, true);

            //切换新id
            for (const key in cfg) {
                const rec = cfg[key];
                if (userAssets.displayGoods.indexOf(rec.id) < 0) {
                    userAssets.unlockLvRec.curId = rec.id;
                    break;
                }
            }

            this.showAward(curId);
        }
        //
    }
    //显示奖励
    showAward(curId) {
        setTimeout(() => {
            UISystem.showUI(UIEnum.UnlockPopUI, { sf: this.assets[curId], type: curId });
        }, 200);
    }

    //#region ------------加载资源-----------
    assets: { [name: string]: SpriteFrame } = null;
    loadRes(cb) {
        if (!this.assets) {
            this.assets = {};
            Loader.loadBundleDir('UI', 'Assets/Images/ShopUI/goods', (assets: SpriteFrame[]) => {
                for (let i = 0; i < assets.length; i++) {
                    const sf = assets[i];
                    this.assets[sf.name] = sf;
                }
                cb && cb();
            }, SpriteFrame, false);
        } else {
            cb && cb();
        }
    }
    //#endregion

}

