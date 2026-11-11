import { _decorator, Component, Node, Prefab, SpriteFrame, instantiate } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
import Loader from '../../Init/Tools/Loader';
import { ShopItem } from './ShopItem';
const { ccclass, property } = _decorator;

@ccclass('ShopUI')
export class ShopUI extends BasicUI {
    @property(Prefab)
    itemPrefab: Prefab = null;
    @property(Node)
    content: Node = null;

    hideCb = null;

    show(d?: { hideCb }) {
        super.show(d);
        if (d) {
            this.hideCb = d.hideCb;
        }
        this.loadRes(() => {
            this.setShopData();
        })

        this.emit(EventTypes.CurLevelEvents.ShowHomeCamera, true);
    }

    hide(d) {
        super.hide(d);
        this.hideCb && this.hideCb();
        this.emit(EventTypes.CurLevelEvents.ShowHomeCamera, false);
    }


    onCloseClick() {
        AudioSystem.playEffect(AudioEnum.BtnClick);
        UISystem.hideUI(UIEnum.ShopUI);
    }

    //#region ----------商品数据-----------
    shopData: { [type: number]: ShopItem } = null;
    setShopData() {
        let userAssets = StorageSystem.getData().userAssets;
        let unlockGoods = userAssets.unlockGoods;
        let displayGoods = userAssets.displayGoods;
        let unlockLvRec = userAssets.unlockLvRec;

        let curWeapon = userAssets.chooseWeapon;
        if (!this.shopData) {
            this.shopData = {};

            //武器类型
            const cfg = GlobalConfig.GoodsCfg.Weapon;
            for (const key in cfg) {
                const cost = cfg[key];
                const type = +key;
                let e = instantiate(this.itemPrefab);
                e.parent = this.content;
                let cmp = new ShopItem(e, this.assets[key], this);  //默认类型与商品图片名称一致

                cmp.init(type, cost,);
                this.shopData[type] = cmp;
            }

        }
        const awardCfg = GlobalConfig.AwardCfg;
        //武器类型
        let wpCount = 0;
        for (const key in this.shopData) {
            const e = this.shopData[key];
            const _id = +key;
            let isUnLock = unlockGoods.indexOf(_id) >= 0;
            let isShow = displayGoods.indexOf(_id) >= 0;
            let curLv = 0;
            if (_id == unlockLvRec.curId) {
                curLv = unlockLvRec.curLv;
            }

            // let resetLv = awardCfg[_id].lv - curLv;
            e.refreshData(isUnLock, isShow, wpCount * 3);
            wpCount++;
        }

        //默认选中当前已选择的
        this.chooseItem(curWeapon);
    }

    resetShopData() {

    }
    //选择
    chooseItem(type) {
        for (const key in this.shopData) {
            const e = this.shopData[key];
            e && e.setChooseMark(type == e.type);
        }
    }

    //#endregion

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
