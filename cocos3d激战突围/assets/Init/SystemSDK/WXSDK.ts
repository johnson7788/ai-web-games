import EventManager from "../Managers/EventManager";
import { EventTypes } from "../Managers/EventTypes";
import { AudioSystem } from "../SystemAudio/AudioSystem";
import { StorageSystem } from "../SystemStorage/StorageSystem";
import SDK from "./SDK";

export class WXSDK extends SDK {

    onEvents() {
        super.onEvents();

        EventManager.on(EventTypes.GameEvents.GameRun, this.onGameRun, this);
        EventManager.on(EventTypes.GameEvents.GameOver, this.onGameOver, this);
    }

    protected setAdCfg(): void {
        // this.adConfig.adBannerIdList = ["adunit-54330508d48d3e28", "adunit-acb20dfa27f6f92c", "adunit-cb5819b2c5cf6b4b",];    // 指定 Banner 单元广告ID
        // // 指定激励视频广告ID,
        // this.adConfig.adVideoIdList = [
        //     'adunit-b0e7eddf4e5df691', //通用于所有钞票领取场景 0
        //     'adunit-27b5b53348173c59', //仅用于武器获取（商店与关卡解锁） 1
        //     'adunit-68c40bc2f8286d8f', //用于首页人物三属性升级 2
        //     'adunit-c2dcadc77dfcfd3e', //仅用户通关失败复活场景 3
        // ];
        // this.adConfig.adInterstitialId = "adunit-37b2d7b671e454be"; // 指定插屏广告ID
        // this.adConfig.shareInfoArr = [{ title: "一起来挑战吧!", img: '' }]; // 自定义分享
        // this.adConfig.adCustomIdList = [
        //     "adunit-4c51dbb4aada6db3",  // UI 5x5
        //     "adunit-ad540b2f0e4179da",  // 游戏中 左侧
        //     "adunit-ad540b2f0e4179da",  // 游戏中 右侧 //adunit-c7b2052a424e2113
        //     "adunit-bb24d5c8c74ae3c5",  // UI 底部-H
        //     "adunit-b44d8750878ef6ad",  // UI 右上单格子
        //     "adunit-b44d8750878ef6ad",  // Game 右上单格子
        //     "adunit-9ea2c7f045a97b37",  // UI 5x3
        // ];     // 指定原生模板广告ID，原生模板广告支持多个
        // //设置banner刷新间隔
        // uniSdk.AdPlat.instance.setBannerMaxShowTimes(10);
    }

    /**
       * 插屏广告
       */
    protected showInterstitial(d?: { success?: Function, fail?: Function, close?: Function }, cb2?) {
        console.log("showInterstitial");
        //触摸屏蔽
        // EventManager.emit(EventTypes.GameEvents.SetTouchMaskEnable,)
        uniSdk.showInterstitial((showed: boolean) => {
            if (showed) {
                console.log("插屏广告显示成功");
                d && d.success && d.success();
            }
            else {
                console.log("插屏广告显示失败， 这里处理失败的逻辑");
                d && d.fail && d.fail();
            }
        }, () => {
            console.log("插屏广告被用户关闭， 这里处理广告关闭后的逻辑");
            d && d.close && d.close();
        }, this);

    }

    /**
     * 显示原生模板广告
     */
    protected showCustomAd(adIndex: number, d?: { success?: Function, fail?: Function, close?: Function }) {
        console.log("showCustomAd:", adIndex);
        // 第一个参数 0 表示：使用原生模板广告配置中的第一个广告ID
        uniSdk.showCustomAd(adIndex, (showed: boolean) => {

            if (showed) {
                console.log("原生模板广告显示成功");
                d && d.success && d.success();
            }
            else {
                console.log("原生模板广告显示失败 ");
                d && d.fail && d.fail();
                // 原生模板广告失败，尝试用插屏广告顶上
                // uniSdk.showInterstitial();
            }

        }, () => {
            d && d.close && d.close();
            console.log("原生模板广告被用户关闭 ");
        }, this);
    }

    /**
       * 拉起激励视频广告
       */
    protected showRewardedVideo(cb: Function | { success: Function, fail: Function, cancel: Function }, idx = 0) {
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
        uniSdk.showRewardedVideo(idx, (status: number) => {
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


    //#region -------------事件---------------
    onGameRun() {
        let asset = StorageSystem.getData().levelAssets;
        this.reportAldStageStart(asset.curLv);
    }
    onGameOver(isWin) {
        let asset = StorageSystem.getData().levelAssets;

        if (isWin) {
            this.reportAldStageEnd(asset.curLv);
        } else {
            this.reportAldStageFail(asset.curLv);
        }
    }

    //#endregion
}
