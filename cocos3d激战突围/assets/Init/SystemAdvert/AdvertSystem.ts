import { Node } from "cc";
import { BasicSystem } from "../Basic/BasicSystem";
import { WXAdvertUIConfig, TTAdvertUIConfig } from "../Managers/AdvertManager/AdvertUIConfig";
import EventManager from "../Managers/EventManager";
import { EventTypes } from "../Managers/EventTypes";
import { SDKSystem, PlatformType } from "../SystemSDK/SDKSystem";
import { StorageSystem } from "../SystemStorage/StorageSystem";
import { clog } from "../Tools/ColorLog";


export class AdvertSystem extends BasicSystem {
    private static uiLayer: Node = null;
    public static init(uiLayer?: any): void {
        this.uiLayer = uiLayer;

        if (this.isInit) return;
        this.isInit = true;

        this.onEvents();

        this.isInitFinished = true;
    }

    public static onEvents() {
        EventManager.on(EventTypes.GameEvents.UIChanged, this.onUIChanged, this);

    }

    //获取当前最顶部显示的UI 对应的配置信息
    public static getTopActiveUI(adCfg) {
        for (let i = this.uiLayer.children.length - 1; i >= 0; i--) {
            const node = this.uiLayer.children[i];
            if (node) {
                const ui = node.children[0];
                if (ui && ui.active && adCfg[ui.name]) {
                    clog.mark('TopUI: ', ui.name);
                    return adCfg[ui.name];
                }
            }
        }
    }

    public static startLv = 0; //限制广告显示的关卡

    public static onUIChanged() {
        if (StorageSystem.getData().levelAssets.curLv <= this.startLv) return;
        //根据当前UI 加载广告数据
        let _cfg;
        switch (SDKSystem._curPlatform) {
            case PlatformType.PCMiniGame:
            case PlatformType.WXMiniGame:
                _cfg = WXAdvertUIConfig;
                break;
            case PlatformType.TTMiniGame:
                _cfg = TTAdvertUIConfig;
                break;
            default:
                break;
        }

        //-------------banner
        if (!!_cfg) {
            const adCfg = this.getTopActiveUI(_cfg);
            if (!adCfg) {
                return;
            }

            //banner
            if (adCfg.banner != undefined) {
                if (adCfg.banner) {
                    EventManager.emit(EventTypes.SDKEvents.ShowBanner);
                } else {
                    EventManager.emit(EventTypes.SDKEvents.HideBanner);
                }
            }
        }

    }

}

