import SDK from "./SDK";

export class OPPOSDK extends SDK {

    onEvents() {
        super.onEvents();

    }

    protected setAdCfg(): void {
        // 萌萌保卫战
        // 包名：com.qxy.game.cutedefend.kyx.nearme.gamecenter
        // appid：31046291
        // appkey： cjaGntmbQbWOc880cg0cS84cC(勿外泄)
        // appsecret：6F0421a0e2B7E81F339904f4FB79b409
        // 广告ID：	
        // 萌萌保卫战
        // ID: 31046291
        // 萌萌保卫战-小游戏-banner
        // ID: 884513
        // 萌萌保卫战-小游戏-视频
        // ID: 884517
        // 萌萌保卫战-小游戏-九宫格
        // ID: 884519
        // 萌萌保卫战-小游戏-icon
        // ID: 884521
        this.adConfig.app_key = '31046291';
        this.adConfig.adBannerIdList = ["884513"];      // 指定 Banner 单元广告ID
        this.adConfig.adVideoIdList = ["884517"];       // 指定激励视频广告ID,
        this.adConfig.adInterstitialId = "884521";            // 指定插屏广告ID
        this.adConfig.adCustomIdList = ["884519"];      // 指定原生模板广告ID，原生模板广告支持多个
    }

    protected showBanner() { }
    protected hideBanner() { }
    protected showInterstitial(cb1?, cb2?) {
        cb2 && cb2();
    }

    protected showCustomAd(adIndex: number) {
    }

    protected hideCustomAd(adIndex: number) { }

    //退出游戏
    protected onExitApp() {
        console.log('退出游戏')
        if (window["qg"]) {
            window["qg"].exitApplication({});
        }

    }
}
