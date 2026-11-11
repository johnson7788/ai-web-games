import { _decorator, Component, Node, Vec3, Prefab } from 'cc';
import { BasicUI } from '../../Init/Basic/BasicUI';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { PlatformType, SDKSystem } from '../../Init/SystemSDK/SDKSystem';
import GlobalPool from '../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

export enum WXCustomADType {
    customGrid1X1 = 'customGrid1X1',
    customHorizon1X3 = 'customHorizon1X3',
    customVertical1X3 = 'customVertical1X3',
}

@ccclass('CustomAdUI')
export class CustomAdUI extends BasicUI {
    @property(Prefab)
    customGrid1X1: Prefab = null;
    @property(Prefab)
    customHorizon1X3: Prefab = null;
    @property(Prefab)
    customVertical1X3: Prefab = null;

    //广告记录
    adRecords: { [id: string]: Node } = {};
    isInit = false;

    init() {
        if (!this.isInit) {
            GlobalPool.createPool(WXCustomADType.customGrid1X1, this.customGrid1X1);
            GlobalPool.createPool(WXCustomADType.customHorizon1X3, this.customHorizon1X3);
            GlobalPool.createPool(WXCustomADType.customVertical1X3, this.customVertical1X3);
        }
    }
    onEvents() {
        this.on(EventTypes.WXCustomAD.ShowGridAd, this.onShowGridAd, this);
        this.on(EventTypes.WXCustomAD.ShowHorizonAd, this.onShowHorizonAd, this);
        this.on(EventTypes.WXCustomAD.ShowVerticalAd, this.onShowVerticalAd, this);
        this.on(EventTypes.WXCustomAD.HideAdByAdId, this.onHideAdByAdId, this);
    }
    show(d?) {
        if (SDKSystem._curPlatform != PlatformType.PCMiniGame &&
            SDKSystem._curPlatform != PlatformType.WXMiniGame) {
            console.log(' 非指定平台 ,隐藏CustomAdUI')
            return;
        }
        this.init();
        super.show();
    }
    hide(d?) {
        super.hide(d);
    }

    update(dt) {
    }

    //#endregion

    //#region -----------------单个格子广告--------------
    onShowGridAd(d: { p: Vec3, cb: (adId) => void }) {
        if (!d || !this.node.activeInHierarchy) return;
        const itemList: uniSdk.AdItemData[] = uniSdk.Global.adItemDataList;
        if (itemList.length > 0) {
            let randId = Math.floor(Math.random() * itemList.length);
            let item = itemList[randId];
            let ad = GlobalPool.get(WXCustomADType.customGrid1X1, item);
            ad.parent = this.node;
            ad.setPosition(d.p);

            d.cb && d.cb(ad.uuid);
            this.adRecords[ad.uuid] = ad;
        }
    }
    //#endregion
    //#region -----------------单行水平格子广告--------------
    onShowHorizonAd(d: { p: Vec3, num: number, cb: (adId) => void }) {
        if (!d || !this.node.activeInHierarchy) return;
        const itemList: uniSdk.AdItemData[] = uniSdk.Global.adItemDataList;
        if (itemList.length > 0) {
            let n = d.num || 3;
            let arr = [];
            itemList.forEach(index => { arr.push(index) })
            let adArr = [];
            for (let i = 0; i < n; i++) {
                let randId = Math.floor(Math.random() * arr.length);
                let item = itemList[randId];
                arr.splice(randId, 1);
                adArr.push(item);
            }
            let ad = GlobalPool.get(WXCustomADType.customHorizon1X3, adArr);
            ad.parent = this.node;
            ad.setPosition(d.p);
            d.cb && d.cb(ad.uuid);

            this.adRecords[ad.uuid] = ad;
        }
    }
    //#endregion
    //#region -----------------单行垂直格子广告--------------
    onShowVerticalAd(d: { p: Vec3, num: number, cb: (adId) => void }) {
        if (!d || !this.node.activeInHierarchy) return;
        const itemList: uniSdk.AdItemData[] = uniSdk.Global.adItemDataList;
        if (itemList.length > 0) {
            let n = d.num || 3;
            let arr = [];
            itemList.forEach(index => { arr.push(index) })
            let adArr = [];
            for (let i = 0; i < n; i++) {
                let randId = Math.floor(Math.random() * arr.length);
                let item = itemList[randId];
                arr.splice(randId, 1);
                adArr.push(item);
            }
            let ad = GlobalPool.get(WXCustomADType.customVertical1X3, adArr);
            ad.parent = this.node;
            ad.setPosition(d.p);
            d.cb && d.cb(ad.uuid);

            this.adRecords[ad.uuid] = ad;
        }
    }
    //#endregion

    //#region ---------------隐藏广告---------
    // 隐藏广告
    onHideAdByAdId(id?) {
        if (!this.node.activeInHierarchy) return;

        for (const key in this.adRecords) {
            const ad = this.adRecords[key];
            if (undefined === id) {
                GlobalPool.put(ad);
                delete this.adRecords[key];
            } else {
                if (id == key) {
                    GlobalPool.put(ad);
                    delete this.adRecords[key];
                }
            }
        }
    }
    // #endregion
}

