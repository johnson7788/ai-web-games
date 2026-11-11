import SDK from "./SDK";

export class VIVOSDK extends SDK {

    onEvents() {
        super.onEvents();

    }

    protected setAdCfg(): void {
        // 萌萌保卫战（激战突围混淆代码）
        // 包名: com.qxy.game.dafendcute.vivominigame
        // App - key: dac83edd168a8d5b2cc0be9510670a32
        // App - ID: 105646780
        // Cp - ID: 259695f36938de6410f2
        // 广告ID：
        // 萌萌保卫战
        // MediaID：96fd4d36bd254bae86edd21b7ad64cb5
        // 萌萌保卫战 - 小游戏 - banner
        // posID：7378580d2e78476ea720f4388bb3aa6d
        // 萌萌保卫战 - 小游戏 - 原生纯图
        // posID：f785e24608e84534ad482135d24b8528
        // 萌萌保卫战 - 小游戏 - 视频
        // posID：4b45619a2f194d80a2846b54e3619286
        // 萌萌保卫战 - 小游戏 - 九宫格
        // posID：93057d73de2b4e7eaa9c49457d5e12b8
        // 萌萌保卫战 - 小游戏 - 横幅
        // posID：2d15987ff5914e00893cc35ed2df1bfd

        this.adConfig.app_key = 'dac83edd168a8d5b2cc0be9510670a32';
        this.adConfig.adBannerIdList = ["7378580d2e78476ea720f4388bb3aa6d"];      // 指定 Banner 单元广告ID
        this.adConfig.adVideoIdList = ["4b45619a2f194d80a2846b54e3619286"];       // 指定激励视频广告ID,
        this.adConfig.adInterstitialId = "";            // 指定插屏广告ID
        this.adConfig.adCustomIdList = ["f785e24608e84534ad482135d24b8528"];      // 指定原生模板广告ID，原生模板广告支持多个
        this.adConfig.adBoxPortalId = '93057d73de2b4e7eaa9c49457d5e12b8';
        this.adConfig.adBoxBannerId = '2d15987ff5914e00893cc35ed2df1bfd';
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
