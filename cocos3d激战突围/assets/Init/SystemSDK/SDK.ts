import EventManager from "../Managers/EventManager";
import { EventTypes } from "../Managers/EventTypes";
import { AudioSystem } from "../SystemAudio/AudioSystem";
import { clog } from "../Tools/ColorLog";

export default class SDK {
    protected api = null;
    protected adConfig: uniSdk.AdConfig = null;

    public init(callback?: Function, target?: any) {
        this.onEvents();
        //第一步：先配置好广告单元ID
        this.adConfig = new uniSdk.AdConfig();
        this.setAdCfg();
        this.initSdk(callback, target);
    }

    // 监听事件
    protected onEvents() {
        EventManager.on(EventTypes.SDKEvents.ShowBanner, this.showBanner, this);
        EventManager.on(EventTypes.SDKEvents.HideBanner, this.hideBanner, this);
        EventManager.on(EventTypes.SDKEvents.ShowVideo, this.showRewardedVideo, this);
        EventManager.on(EventTypes.SDKEvents.ShowInsertAd, this.showInterstitial, this);
        EventManager.on(EventTypes.SDKEvents.ShowCustomAd, this.showCustomAd, this);
        EventManager.on(EventTypes.SDKEvents.HideCustomAd, this.hideCustomAd, this);
        EventManager.on(EventTypes.SDKEvents.Share, this.share, this);
        EventManager.on(EventTypes.SDKEvents.ExitApp, this.onExitApp, this);

        //ALD上报
        EventManager.on(EventTypes.SDKEvents.ReportAldEvent, this.reportAldEvent, this);
        EventManager.on(EventTypes.SDKEvents.ReportAldStageStart, this.reportAldStageStart, this);
        EventManager.on(EventTypes.SDKEvents.ReportAldStageWin, this.reportAldStageEnd, this);
        EventManager.on(EventTypes.SDKEvents.ReportAldStageFail, this.reportAldStageFail, this);
        EventManager.on(EventTypes.SDKEvents.ReportAldStageAward, this.reportAldStageAward, this);
        EventManager.on(EventTypes.SDKEvents.ReportAldStageTools, this.reportAldStageTools, this);
        EventManager.on(EventTypes.SDKEvents.ReportEvent, this.reportEvent, this);
    }

    /**
    * 初始化SDK，操作所在SDK接口之前必须对SDK进行初始化 
    */
    protected setAdCfg() {
        /**
         * 第一步：先配置好广告单元ID
         */
        // 这里的 app_key 请登陆 https://zerosgame.com/admin 查看
        // this.adConfig.app_key = "dqxekvujtxxrtoub";
        // this.adConfig.adBannerIdList = ["adunit-e29df638c636869a", "adunit-5471e710c78c639b", "adunit-a4d4fbc1357dfa4e"];    // 指定 Banner 单元广告ID
        // this.adConfig.adVideoIdList = ["adunit-1344099b40bbe089"];        // 指定激励视频广告ID,
        // this.adConfig.adInterstitialId = "adunit-a3cc34c12c4d8f85"; // 指定插屏广告ID
        // this.adConfig.adCustomIdList = ["adunit-6b13bdce9b8c6ef9"];     // 指定原生模板广告ID，原生模板广告支持多个
        // this.adConfig.shareInfoArr = [{ title: "一起来玩吧!", img: "" }]; // 自定义分享

        // //导出
        // this.adConfig.isExportWxGameAd = true;
    }

    private initSdk(callback?: Function, target?: any) {
        // 带着广告配置信息去初始化SDK
        uniSdk.init(this.adConfig, (userInfo: uniSdk.UserInfo) => {
            if (userInfo && userInfo.uid) {
                console.log('初始化SDK 完成!', userInfo);
                console.log("用户微信ID:" + userInfo.openid);
                console.log("用户UID:" + userInfo.uid);
                console.log("用户昵称:" + userInfo.nickName);
                console.log("用户头像:" + userInfo.avatarUrl);
                console.log("用户当前游戏关卡:" + userInfo.gameLevel);
                console.log("用户当前金币:" + userInfo.money);
            }

            if (callback) callback.call(target);
        }, this);
    }

    //#region ----------------功能---------
    //提示消息
    protected showMessage(msg: string) {
        EventManager.emit(EventTypes.GameEvents.ShowTips, msg);
    }

    //#endregion
    //#region ----------------ALD-------
    /**上报微信 openid 到阿拉丁 */
    protected reportWXAldOpenId(d) {

    }
    /**上报阿拉丁事件数据 */
    protected reportAldEvent(d) {

    }
    /**上报阿拉丁游戏关卡开始 */
    protected reportAldStageStart(lvId: number, desc?: string) {
        uniSdk.Global.reportAldStageStart(lvId, desc);
    }
    /**上报阿拉丁游戏关卡成功 */
    protected reportAldStageEnd(lvId: number, desc?: string) {
        uniSdk.Global.reportAldStageEnd(lvId, desc);
    }
    /**上报阿拉丁游戏关卡失败 */
    protected reportAldStageFail(lvId: number, desc?: string) {
        uniSdk.Global.reportAldStageFail(lvId, desc);
    }
    /**上报阿拉丁游戏关卡进行中奖励行为 */
    protected reportAldStageAward(d) {

    }
    /**上报阿拉丁游戏关卡进行中使用道具行为 */
    protected reportAldStageTools(d) {

    }
    /**上报游戏事件 */
    protected reportEvent(d) {

    }
    //#endregion

    // #region -----------------事件---------------
    /**
       * 显示 Banner 广告
       */
    protected showBanner() {
        console.log("showBanner");
        uniSdk.showBanner();
    }

    /**
     * 手动关闭 Banner 广告
     */
    protected hideBanner() {
        console.log("hideBanner");
        uniSdk.hideBanner();
    }

    /**
     * 拉起激励视频广告
     */
    protected showRewardedVideo(cb: Function | { success: Function, fail: Function, cancel: Function }) {
        let success = null;
        let fail = null;
        let cancel = null;
        if (typeof cb === 'object') {
            success = cb.success;
            fail = cb.fail;
            cancel = cb.cancel;
        } else {
            success = cb;
        }
        //暂停游戏
        EventManager.emit(EventTypes.GameEvents.GamePause);
        AudioSystem.pauseBGM();
        //
        console.warn('观看视频中');
        uniSdk.showRewardedVideo(0, (status: number) => {
            if (status == 1) {
                console.log("激励视频已观看完毕 ");
                success && success();
                //恢复游戏
                EventManager.emit(EventTypes.GameEvents.GameResume);
                AudioSystem.resumeBGM();
            }
            else if (status == 0) {
                console.log("激励视频未观看完毕 ");
                cancel && cancel();
                EventManager.emit(EventTypes.GameEvents.GameResume);
                AudioSystem.resumeBGM();
            }
            else {
                console.log("激励视频加载失败 ");
                fail && fail();
                EventManager.emit(EventTypes.GameEvents.GameResume);
                AudioSystem.resumeBGM();
            }

        }, this);
    }

    /**
     * 插屏广告
     */
    protected showInterstitial(cb1?, cb2?) {
        console.log("showInterstitial-SDK");
        //触摸屏蔽
        // EventManager.emit(EventTypes.GameEvents.SetTouchMaskEnable,)
        uniSdk.showInterstitial((showed: boolean) => {
            if (showed) {
                console.log("插屏广告显示成功");
            }
            else {
                console.log("插屏广告显示失败， 这里处理失败的逻辑");
                // 插屏广告显示失败， 尝试原生模板
                uniSdk.showCustomAd(0);
            }
            cb1 && cb1(showed);
        }, () => {
            console.log("插屏广告被用户关闭， 这里处理广告关闭后的逻辑");
            cb2 && cb2();
        }, this);

    }

    /**
     * 显示原生模板广告
     */
    protected showCustomAd(adIndex: number) {
        console.log("SDK-showCustomAd");
        // 第一个参数 0 表示：使用原生模板广告配置中的第一个广告ID

        uniSdk.showCustomAd(adIndex, (showed: boolean) => {
            if (showed) {
                console.log("原生模板广告显示成功");
            }
            else {
                console.log("原生模板广告显示失败 ");
                // 原生模板广告失败，尝试用插屏广告顶上
                uniSdk.showInterstitial();
            }

        }, () => {
            console.log("原生模板广告被用户关闭 ");
        }, this);
    }

    /**
     * 手动关闭原生模板广告
     */
    protected hideCustomAd(adIndex: number) {
        console.log("hideCustomAd");

        // 第一个参数 0 表示：关闭原生模板广告配置中的第一个广告
        uniSdk.hideCustomAd(adIndex);
    }

    /**
     * 自定义分享
     */
    protected share() {
        console.log("share");
        uniSdk.share();
    }
    // #endregion

    //退出游戏
    protected onExitApp() {

    }
}


/**
 * 重写SDK内的getCustomAdStyle方法重新定义原生模板广告的显示样式
 */
uniSdk.getCustomAdStyle = function (index: number) {
    let sysinfo: SystemInfo = uniSdk.getSystemInfo();
    //实际分辨率宽高
    console.log('sysinfo:', sysinfo.windowHeight, sysinfo.windowWidth);
    let style: any = null;

    if (uniSdk.Global.isWxgame) {
        //
        let width = 320;
        let height = 400;
        let top = 0;
        let left = 0;

        switch (index) {
            case 0:     // UI 5x5
                width = 320;
                height = 400;
                top = ((sysinfo.windowHeight - height) * 0.5) - 30;
                left = (sysinfo.windowWidth - width) * 0.5;
                break;
            case 1: //homeLeft 
                width = 110;
                height = 110;
                top = (sysinfo.windowHeight - height) * 0.5 - 50;
                left = 10;
                break;
            case 2: //homeRight
                width = 110;
                height = 110;
                top = (sysinfo.windowHeight - height) * 0.5 - 50;
                left = sysinfo.windowWidth - width * 0.5 - 10;
                break;
            case 3: //UI 底部-水平
                width = 320;
                height = 110;
                top = (sysinfo.windowHeight - height) * 0.5 + 300;
                left = (sysinfo.windowWidth - width) * 0.5;
                break;
            case 4: //UI 右上单格子
                width = 110;
                height = 110;
                top = (sysinfo.windowHeight - height) * 0.5 - 20;
                left = sysinfo.windowWidth - width * 0.5 - 10;
                break;
            case 5: //Game 右上单格子
                width = 110;
                height = 110;
                top = 55;
                left = sysinfo.windowWidth - width * 0.5 - 10;
                break;
            case 6:     // UI 5x3
                width = 320;
                height = 400;
                top = ((sysinfo.windowHeight - height) * 0.5) - 30;
                left = (sysinfo.windowWidth - width) * 0.5;
                break;
        }

        style = {
            top: top,
            left: left,
            fixed: false,
            width: width
        }
    }
    return style;
}