declare module uniSdk {
    class BrowersUtils {
        static reload(): void;
        static redirect(url: string): void;
        /**
         * 是否在微信中打开
         */
        static isWechat(): boolean;
        static isAndroid(): boolean;
        static GetRequest(name: string): any;
    }
}
declare module uniSdk {
    class Global {
        /**
         * 屏幕高度
         */
        static screenHeight: number;
        /**
         * 屏幕宽度
         */
        static screenWidth: number;
        /**
         * 用户信息
         */
        static userInfo: UserInfo;
        /**
         * 应用KEY
         */
        static appKey: string;
        /**
         * 阿拉丁KEY
         */
        static aldKey: string;
        /**
         * 渠道
         */
        static channel: string;
        /**
         * 平台名称
         */
        static platformName: string;
        /**
         * 引擎类型
         * 1：egret
         * 2:cocos
         * 3:layabox
         */
        static engineType: number;
        /**
         * 微信小游戏导出列表
         */
        static adItemDataList: AdItemData[];
        static gameConfig: any;
        static curGameLevel: number;
        static lastEventName: string;
        /**
         * API接口地址
         */
        static API_URL: string;
        static doPost(url: string, data?: any, callback?: Function, thisObj?: any): void;
        static doGet(url: string, callback?: Function, thisObj?: any): void;
        static setLocalStorage(key: string, value: string): void;
        static getLocalStorage(key: string, defaultValue?: string): string;
        static clearLocalStorage(key: string): void;
        /**
         * 上报微信 openid 到阿拉丁
         */
        static reportAldOpenId(openid: string): void;
        /**
         * 上报阿拉丁事件数据
         */
        static reportAldEvent(eventName: string, eventParams?: any): void;
        /**
         * 上报阿拉丁游戏关卡开始
         * reportAldStageStart接口已废除， 请使用 uniSdk.gameLevelStarted 接口
         */
        static reportAldStageStart(stageId: number, stageName?: string): void;
        /**
         * 上报阿拉丁游戏关卡成功
         * reportAldStageEnd接口已废除， 请使用 uniSdk.gameLevelEnded 接口
         */
        static reportAldStageEnd(stageId: number, stageName?: string): void;
        /**
         * 上报阿拉丁游戏关卡失败
         * reportAldStageFail接口已废除， 请使用 uniSdk.gameLevelEnded 接口
         */
        static reportAldStageFail(stageId: number, stageName?: string): void;
        /**
         * 上报阿拉丁游戏关卡进行中奖励行为
         * reportAldStageAward接口已废除， 请使用 uniSdk.gameLevelAward 接口
         */
        static reportAldStageAward(stageId: number, stageName?: string, itemName?: string): void;
        /**
         * 上报阿拉丁游戏关卡进行中使用道具行为
         * reportAldStageTools接口已废除， 请使用 uniSdk.gameLevelTools 接口
         */
        static reportAldStageTools(stageId: number, stageName?: string, itemName?: string, itemCount?: number): void;
        /**
         * 上报游戏事件
         * @param strevent 事件描述
         */
        static reportEvent(strevent: string): void;
        /**
         * 游戏进入后台
         */
        static pause(): void;
        /**
         * 游戏进入前台
         */
        static resume(): void;
        static get isWxgame(): boolean;
        static get isQQGame(): boolean;
        static get isVivogame(): boolean;
        static get isOppogame(): boolean;
        static get isTTGame(): boolean;
        static get isFastGame(): boolean;
        static get isXiaoMiGame(): boolean;
        static get isH5(): boolean;
    }
}
declare module uniSdk {
    class Cmd {
        static SDK_INIT_COMPLETED: string;
    }
    /**
     * 消息监听事件分发
     */
    class MessageProxy {
        static maps: any;
        protected static messageDispatching: boolean;
        static addListener(name: string, listener?: Function, target?: any, autoRemove?: boolean): Function;
        static removeListener(name: string, listener?: Function, target?: any): void;
        static clear(): void;
        static dispatch(name: string, message?: any): boolean;
    }
}
declare module uniSdk {
    /** 九宫格, vivo 是横幅与九宫格图标是相互的 */
    function createBoxAd(): void;
    /** 九宫格 */
    function destroyBoxAd(): void;
    function showFloatAd(): void;
    function hideFloatAd(): void;
    function showNativeAdvertisement(callback?: Function, thisObj?: any): void;
    /** 设置 游戏著作权人 Label 控件 */
    function setOwnerNameLabel(label: any): void;
    /** 设置 隐私协议 Label 控件 */
    function setPrivacyAgreementLabel(label: any): void;
}
declare class SystemInfo {
    /** 手机品牌*/
    brand: string;
    /** 手机型号*/
    model: string;
    /**	设备像素比 */
    pixelRatio: number;
    /** 屏幕宽度*/
    screenWidth: number;
    /** 屏幕高度*/
    screenHeight: number;
    /** 可使用窗口宽度*/
    windowWidth: number;
    /** 可使用窗口高度*/
    windowHeight: number;
    /** 微信设置的语言*/
    language: string;
    /** 微信版本号*/
    version: string;
    /** 操作系统版本*/
    system: string;
    /** 客户端平台*/
    platform: string;
    /** 用户字体大小设置。以“我-设置 - 通用 - 字体大小”中的设置为准，单位 px。*/
    fontSizeSetting: number;
    /** 客户端基础库版本*/
    SDKVersion: string;
    /** 性能等级*/
    benchmarkLevel: number;
    /** 电量，范围 1 - 100*/
    battery: number;
    /** wifi 信号强度，范围 0 - 4 */
    wifiSignal: number;
    /** 屏幕安全区 */
    safeArea: {
        left: number;
        right: number;
        top: number;
        bottom: number;
        width: number;
        height: number;
    };
}
declare interface OpenDataContext {
    /**
     * 向开放数据域发送消息
     */
    postMessage(message: {}): void;
}
declare const wx: {
    /**
     * 获取开放数据域
     */
    getOpenDataContext(): OpenDataContext;
    /**
     * 获取系统信息
     */
    getSystemInfoSync(): SystemInfo;
    /**
     * 创建 banner 广告组件
     */
    createBannerAd(object: {
        adUnitId: string;
        adIntervals: number;
        style: any;
    }): BannerAd;
    /**
     * 创建激励视频广告组件
     */
    createRewardedVideoAd(object: {
        adUnitId: string;
    }): RewardedVideoAd;
    /**
     * 创建插屏广告组件
     */
    createInterstitialAd(object: {
        adUnitId: string;
    }): InterstitialAd;
};
declare const tt: {
    getSystemInfoSync(): SystemInfo;
    /**
     * 创建 banner 广告组件
     */
    createBannerAd(object: {
        adUnitId: string;
        adIntervals: number;
        style: any;
    }): BannerAd;
    /**
     * 创建激励视频广告组件
     */
    createRewardedVideoAd(object: {
        adUnitId: string;
    }): RewardedVideoAd;
    /**
     * 创建插屏广告组件
     */
    createInterstitialAd(object: {
        adUnitId: string;
    }): InterstitialAd;
};
declare interface BannerAd {
    style: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    /**
     * 显示 banner 广告
     */
    show(): any;
    /**
     * 隐藏 banner 广告
     */
    hide(): any;
    /**
     * 销毁 banner 广告
     */
    destroy(): any;
    /**
     * 监听 banner 广告尺寸变化事件
     */
    onResize(callback?: any): any;
    /**
     * 取消监听 banner 广告尺寸变化事件
     */
    offResize(callback?: any): any;
    /**
     * 监听 banner 广告加载事件
     */
    onLoad(callback?: any): any;
    /**
     * 取消监听 banner 广告加载事件
     */
    offLoad(callback?: any): any;
    /**
     * 监听 banner 广告错误事件
     */
    onError(callback?: any): any;
    /**
     * 取消监听 banner 广告错误事件
     */
    offError(callback?: any): any;
}
declare interface CustomAd {
    /**
     * 显示原生模板广告
     */
    show(): any;
    /**
     * 隐藏原生模板广告
     */
    hide(): any;
    /**
     * 销毁原生模板广告
     */
    destroy(): any;
    /**
     * 查询原生模板广告展示状态
     */
    isShow(): boolean;
    /**
     * 监听原生模板广告加载事件
     */
    onLoad(callback?: any): any;
    /**
     * 取消监听原生模板广告加载事件
     */
    offLoad(callback?: any): any;
    /**
     * 监听原生模板广告错误事件
     */
    onError(callback?: any): any;
    /**
     * 取消监听原生模板广告错误事件
     */
    offError(callback?: any): any;
    /**
     * 监听原生模板广告关闭事件
     */
    onClose(callback?: any): any;
    /**
     * 取消监听原生模板广告关闭事件
     */
    offClose(callback?: any): any;
    /**
     * 监听原生模板广告隐藏事件
     */
    onHide(callback?: any): any;
    /**
     * 取消监听原生模板广告隐藏事件
     */
    offHide(callback?: any): any;
}
declare interface RewardedVideoAd {
    /**
     * 加载激励视频广告
     */
    load(): any;
    /**
     * 销毁激励视频广告实例
     */
    destroy(): any;
    /**
     * 监听激励视频广告加载事件
     */
    onLoad(callback?: any): any;
    /**
     * 取消监听激励视频广告加载事件
     */
    offLoad(callback?: any): any;
    /**
     * 监听用户点击 关闭广告 按钮的事件
     */
    onClose(callback?: any): any;
    /**
     * 取消监听用户点击 关闭广告 按钮的事件
     */
    offClose(callback?: any): any;
    /**
     * 监听激励视频错误事件
     */
    onError(callback?: any): any;
    /**
     * 取消监听激励视频错误事件
     */
    offError(callback?: any): any;
    /**
     * 显示激励视频广告
     */
    show(): any;
}
declare interface InterstitialAd {
    /**
     * 显示插屏广告
     */
    show(): any;
    /**
     * 加载插屏广告
     */
    load(): any;
    /**
     * 销毁插屏广告实例
     */
    destroy(): any;
    /**
     * 监听插屏广告加载事件
     */
    onLoad(callback?: any): any;
    /**
     * 取消监听插屏广告加载事件
     */
    offLoad(callback?: any): any;
    /**
     * 监听插屏广告关闭事件
     */
    onClose(callback?: any): any;
    /**
     * 取消监听插屏广告关闭事件
     */
    offClose(callback?: any): any;
    /**
     * 监听插屏错误事件
     */
    onError(callback?: any): any;
    /**
     * 取消监听插屏错误事件
     */
    offError(callback?: any): any;
}
/**
 * 字节平台的录屏管理器
 */
declare interface GameRecorderManager {
    /**
     * 开始录屏
     */
    start(options?: {
        duration: number;
    }): any;
    /**
     * 暂停录屏
     */
    pause(): any;
    /**
     * 停止录屏
     */
    stop(): any;
    /**
     * 暂停录屏
     */
    pause(): any;
    /**
     * 继续录屏
     */
    resume(): any;
    /**
     * 监听录屏开始事件
     */
    onStart(callback: Function): any;
    /**
     * 监听录屏结束事件，可以获得录屏地址。
     */
    onStop(callback: Function): any;
    /**
     * 监听录屏错误事件
     */
    onError(callback: Function): any;
}
declare module uniSdk {
    let startupTimestamp: number;
    /**
     * 字节平台的最后一次展示视频广告的时间
     * 因为：展示过一次激励视频广告后，后续需要展示插屏广告的情况下，需要与激励视频广告的展示间隔60s。
     */
    let ttLastVideoCreateTimestamp: number;
    /**
     * 初始化
     * adConfig : 广告配置
     * callback : 初始化完成回调 -- 回调方法原型 callback(userInfo?uniSdk.UserInfo)
     * thisObj : 调用者类对象, 通常是 this 对象
     */
    function init(adConfig: AdConfig, callback?: Function, thisObj?: any): void;
    /**
     * 登陆
     */
    function login(callback?: Function, thisObj?: any): void;
    /** 微信用户资料内容安全识别 */
    function userinfo_sec_check(): void;
    /**
     * 授权获取用户信息
     * authorizeDesc : 显示在授权窗口下的描述(默认为： 获取你的昵称、头像)
     */
    function authorizeUserInfo(authorizeDesc?: string, callback?: Function, thisObj?: any): void;
    function showToast(msg: string): void;
    function showPopup(msg: string, confirmFunc?: Function, cancelFunc?: Function, thisObject?: any, cancelVisible?: boolean, title?: string, confirmLabel?: string, cancelLabel?: string): void;
    /**
     * 请求排行榜列表
     * keyword : 排行的字段关键字, 这个字段关键字指的是 uniSdk.UserInfo 下的字段，
     *          比如： 需要对 UserInfo.score 字段排行，即 keyword 传 'score'
     *          又比如：需要对 UserInfo.money 字段排行，即 keyword 传 'money'
     * pageSize : 排行榜名数，比如：需要获取 score 的前面最高的 100 名，即 pageSize 传100
     * callback ：排行结果回调，回调方法原型： callback(rankList:uniSdk.UserInfo);
     * thisObj : 调用者类对象, 通常是 this 对象
     */
    function requestRankList(keyword: string, pageSize?: number, callback?: Function, thisObj?: any): void;
    /**
    * 上报游戏事件
     * @param strevent 事件描述
    */
    function reportEvent(strevent: string): void;
    /**
     * 微信小程序一次性订阅消息
     * @param tmplIds 模板ID列表
     * @param callback
     * @param thisObj
     */
    function subscribeMessage(tmplId: string, callback?: Function, thisObj?: any): void;
    /**
     * 获取系统信息
     */
    function getSystemInfo(): SystemInfo;
    function showGameClubButton(left?: number, top?: number, width?: number, height?: number, iconSkin?: string): void;
    function hideGameClubButton(): void;
    function destoryGameClubButton(): void;
    function vibrateLong(): void;
    /**
     * 短时间的振动
     * type: 振动强度 0: 轻微, 1:中等, 2:强烈
     */
    function vibrateShort(type?: number): void;
    /**
     * 导出小游戏
     * adItem:  传入一个 AdItemData 对象数据
     * callback 成功/失败的回调，callback回传一个 boolean 类型参数 true:导出成功， false: 未导出
     * thisObj 回调对象
     */
    function navigateToMiniProgram(adItemData: AdItemData, callback?: Function, thisObj?: any): void;
    /**
     * 拉取激励视频
     * @param callback 激励视频回调
     * 回调 callback(status:number)
     * status==1 视频播放完毕关闭回调
     * status==0 视频未播放完毕关闭回调
     * status==-1 视频拉取失败回调
     * @param thisObj 调用者类对象, 通常是 this 对象
     */
    function showRewardedVideo(index: number, callback?: Function, thisObj?: any): void;
    /**
     * 拉取插屏广告
     * @param showCallback 广告显示回调，showCallback(showed:boolean) showed: 广告是否显示成功
     * @param showCallback 广告关闭回调 closeCallback()
     * @param thisObj 调用者类对象, 通常是 this 对象
     */
    function showInterstitial(showCallback?: Function, closeCallback?: Function, thisObj?: any): void;
    /**
     * 显示 banner 广告
     */
    function showBanner(index?: number): void;
    /**
     * 手动隐藏 banner 广告
     */
    function hideBanner(): void;
    /**
     * 显示原生广告
     * @param index 对应原生广告配置列表的索引
     * @param showCallback 原生广告的显示加载 showCallback(showed:boolean) 广告是否显示成功
     * @param closeCallback 原生广告关闭回调
     * @param thisObj 调用者类对象, 通常是 this 对象
     */
    function showCustomAd(index?: number, showCallback?: Function, closeCallback?: Function, thisObj?: any): void;
    /**
     * 手动关闭原生广告
     * @param index 对应原生广告配置列表的索引
     */
    function hideCustomAd(index?: number): void;
    function share(query?: any, callback?: Function, shortCall?: Function, thisObj?: any): void;
    /**
     * 显示横幅广告(小米专用)
     * closeCallback 用户手动关闭回调
     */
    function showBoxBannerAd(closeCallback?: Function, thisObj?: any): void;
    /**
     * 隐藏横幅广告(小米专用)
     * isDestroy 是否摧毁横幅广告实例, 默认为 true
     */
    function hideBoxBannerAd(): void;
    /**
     * 创建九宫格广告实例并显示
     */
    function showBoxPortalAd(): void;
    /**
     * 摧毁九宫格广告实例
     */
    function hideBoxPortalAd(): void;
    /**
     * 游戏关卡开始
     * @param level 当前关卡
     */
    function gameLevelStarted(level: number): void;
    /**
     * 游戏关卡结束
     * @param isWin 是否胜利?
     */
    function gameLevelEnded(isWin: boolean): void;
    /**
     * 游戏关卡过程中道具奖励
     * @param desc 奖励描述
     */
    function gameLevelAward(desc?: string): void;
    /**
     * 游戏关卡过程中使用道具
     * @param desc
     */
    function gameLevelTools(desc?: string, itemCount?: number): void;
    function getCustomAdStyle(index: number): {
        top: number;
        left: number;
        fixed: boolean;
        width: number;
    };
    function notityBannerResize(width: number, height: number): void;
}
declare module uniSdk {
    class UserInfo {
        /**
         * 用户ID
         */
        private _uid;
        /**
         * 微信专用 openid
         */
        private _openid;
        /**
         * 用户昵称
         */
        private _nickName;
        /**
         * 用户头像
         */
        private _avatarUrl;
        /**
         * 游戏关卡
         */
        private _gameLevel;
        /**
         * 等级
         */
        private _level;
        /**
         * 用户金币值
         */
        private _money;
        /**
         * 用户积分值
         */
        private _score;
        /**
         * 用户ID
         */
        get uid(): number;
        set uid(value: number);
        /**
         * 微信专用 openid
         */
        get openid(): string;
        set openid(value: string);
        /**
         * 用户昵称
         */
        get nickName(): string;
        set nickName(value: string);
        /**
         * 用户头像
         */
        get avatarUrl(): string;
        set avatarUrl(value: string);
        /**
         * 游戏关卡
         */
        get gameLevel(): number;
        set gameLevel(value: number);
        /**
         * 等级
         */
        get level(): number;
        set level(value: number);
        /**
         * 用户金币值
         */
        get money(): number;
        set money(value: number);
        get score(): number;
        set score(value: number);
        private send;
    }
}
declare module uniSdk {
    abstract class AdBanner {
        abstract setShowTime(time: number): any;
        abstract get isLoaded(): boolean;
        abstract get id(): string;
        abstract show(force?: boolean): any;
        abstract hide(): any;
        abstract destroy(): any;
    }
}
declare module uniSdk {
    class AdConfig {
        /**
         * APPKEY
         */
        app_key: string;
        /**
         * banner ID列表
         */
        adBannerIdList: string[];
        /**
         * 激励视频广告ID列表
         */
        adVideoIdList: string[];
        /**
         * 插屏广告ID
         */
        adInterstitialId: string;
        /**
         * 原生广告ID列表（数组第一个必须为原生矩阵广告单元）
         */
        adCustomIdList: string[];
        /**
         * 横幅广告(vivo/oppo专用)
         */
        adBoxBannerId: string;
        /**
         * 九宫格广告(vivo/oppo专用)
         */
        adBoxPortalId: string;
        /**
         * 分享信息
         * title : 标题
         * img： 图片
         */
        shareInfoArr: {
            title: string;
            img: string;
        }[];
        /**
         * 是否需要导出微信小游戏(仅微信小程序)
         */
        isExportWxGameAd: boolean;
    }
}
declare module uniSdk {
    /**
     * 原生广告
     */
    abstract class AdCustom {
        abstract show(callback?: Function, closeCallback?: Function, thisObj?: any): any;
        abstract hide(): any;
        abstract destroy(): any;
    }
}
declare module uniSdk {
    abstract class AdInterstitial {
        abstract show(callback?: Function, closeCallback?: Function, thisObj?: any): any;
        abstract destroy(): any;
    }
}
declare module uniSdk {
    class AdIPData {
        ip: string;
        country: string;
        province: string;
        city: string;
        county: string;
        isp: string;
        area: string;
    }
}
declare module uniSdk {
    class AdItemData {
        appid: string;
        img: string;
        path: string;
        title: string;
        imageAsset: any;
    }
}
declare module uniSdk {
    class AdMisTouchManager {
        private static _instance;
        static get instance(): AdMisTouchManager;
        misTouchNum: number;
        misTouchFromLevel: number;
        private curMisTouchNum;
        private loadingSceneLevel;
        private loadSceneCallback;
        private loadSceneObj;
        init(level: number, callback?: Function, thisObj?: any): void;
    }
}
declare module uniSdk {
    class AdMisTouchView {
        constructor();
        init(): void;
    }
}
declare module uniSdk {
    class AdPlat {
        private static _instance;
        static get instance(): AdPlat;
        private isInit;
        private ipData;
        private showBannerTimeout;
        private curBannerIndex;
        private showBannerTimestamp;
        private autoBannerCallback;
        private autoBannerCallbackTarget;
        private wx_isShared;
        private wx_sharedCloseTime;
        private shareInfoArr;
        private shareCallback;
        private shareShortCallback;
        private shareCallbackTarget;
        private shareVideoId;
        video: AdRewardedVideo;
        interstitial: AdInterstitial;
        banners: AdBanner[];
        customs: AdCustom[];
        systemInfo: SystemInfo;
        adConfig: AdConfig;
        bannerWidth: number;
        private recorderManager;
        private recordVideoPath;
        private recordState;
        private recordDuration;
        private startRecordTimestamp;
        private stopRecordCallback;
        private stopRecordCallbackTarget;
        private boxBannerAdUnitId;
        private boxBannerAd;
        private boxBannerAdCloseCallback;
        private boxBannerAdCallbackTarget;
        private adBoxPortalUnitId;
        private boxPortalAd;
        private boxPortalAdCloseCallback;
        private boxPortalAdCallbackTarget;
        private bannerShowIntervalTimer;
        /** 当前渠道强变现信息 array("adPlatform"=>"h5","fixTimeSwitch"=>0,"fixStartTime"=>"00:00","fixEndTime"=>"23:59","fixStartWeekTime"=>"00:00","fixEndWeekime"=>"23:59","state"=>0,"independentSwitch"=>0,"mistouchNum"=>0,"mistouchNumFromLevel"=>0,"resultClickMislead"=>0,"otherClickMislead"=>0,"propClickMislead"=>0,"startGameForceAd"=>array(0),"endGameForceAd"=>array(0),"gameForceAd"=>array(10000,2),"disabledRegion"=>array()),  */
        private advertInfo;
        adIdleTime: number;
        getSystemInfoSync(): SystemInfo;
        /**
         * 注册平台各种回调
         */
        private regisiterCallback;
        /**
         * 游戏回到前台的事件
         */
        private onShowCallback;
        /**
         * 游戏隐藏到后台的事件
         */
        private onHideCallback;
        private loginCallback;
        private loginCallbackTarget;
        setLoginCallback(callback: Function, thisObj: any): void;
        login(code: string, openid: string, anonymousCode: string): void;
        private onLoginComplete;
        private rankCallback;
        private rankCallbackTarget;
        requestRankList(keyword: string, pageSize?: number, callback?: Function, thisObj?: any): void;
        private onResponseRankList;
        /**
         * 上报游戏事件
         * @param strevent 事件描述
         */
        reportEvent(strevent: string): void;
        /**
         * 上报游戏关卡开始
         */
        reportGameLevelStartEvent(level: number, strevent: string): void;
        /**
         * 上报游戏结束
         * isWin 1:成功 0：失败
         */
        reportGameLevelEndEvent(level: number, strevent: string, isWin: number): void;
        /**
         * 初始化
         */
        init(config: AdConfig): void;
        initShare(): void;
        initRecord(): void;
        getRecordDuration(): number;
        startRecord(duration?: number): void;
        stopRecord(callback?: Function, thisObj?: any): void;
        pauseRecord(): void;
        resumeRecord(): void;
        /**
         * 分享
         * @param query 分享参数 { channel:moosnow.SHARE_CHANNEL.LINK }
         * SHARE_CHANNEL.LINK, SHARE_CHANNEL.ARTICLE, SHARE_CHANNEL.TOKEN, SHARE_CHANNEL.VIDEO 可选 仅字节跳动有效
         * @param callback 分享成功回调参数 = true, 分享失败回调参数 = false,
         * @param shortCall 时间过短时回调 ,err 是具体错误信息，目前只在头条分享录屏时用到
         */
        share(query?: any, callback?: Function, shortCall?: Function, thisObj?: any): void;
        buildShareInfo(query?: any): any;
        private isVideoShowed;
        private showVideoTimeout;
        showRewardedVideo(index: number, callback?: Function, thisObj?: any): void;
        showInterstitial(showCallback?: Function, closeCallback?: Function, thisObj?: any): void;
        showCustomAd(index?: number, showCallback?: Function, closeCallback?: Function, thisObj?: any): void;
        hideCustomAd(index?: number): void;
        /**
         * 设置banner轮播的间隔时间，单位为秒
         * @param maxTimes 传入一个banner轮播的间隔时间,单位为秒
         */
        setBannerMaxShowTimes(maxTimes: number): void;
        setBannerWidth(width: number): void;
        availableBanner(): AdBanner;
        private createBanner;
        private destroyBanners;
        private createCustom;
        private createRewardedVideo;
        private createInterstitial;
        showBoxBannerAd(closeCallback?: Function, thisObj?: any): void;
        hideBoxBannerAd(isDestroy?: boolean): void;
        private onCloseForBoxBannerAd;
        createBoxPortalAd(marginTop?: number, closeCallback?: Function, thisObj?: any): void;
        destroyBoxPortalAd(): void;
        private onCloseForBoxPortalAd;
        showBanner(index?: number): void;
        hideBanner(): void;
        private changeShowBanner;
        private testIpRegion;
        private initConfig;
        private initConfigComplete;
        private requestIP;
        private requestGameConfig;
        private requestGameExportData;
        private requestGameExportDataComplete;
        private updateValidTimeRange;
        private update;
        private needForceAd;
        private updateForceAd;
        /**
         * 加载Icon资源
         */
        loadAsset(dataItemList: uniSdk.AdItemData[]): void;
        private loadAssetImpl;
    }
}
declare module uniSdk {
    abstract class AdRewardedVideo {
        abstract show(index: number, callback?: Function, thisObj?: any): any;
        abstract destroy(): any;
    }
}
declare module uniSdk {
    class HttpClient {
        private static clientList;
        private url;
        private callback;
        private callbackTarget;
        constructor();
        send(url: string, data?: any, callback?: Function, thisObj?: any, method?: string): boolean;
        destroy(): void;
        private onHttpComplete;
    }
}
declare module uniSdk {
    class WebHttpRequest {
        private _xhr;
        timeout: number;
        private callback;
        private callbackTarget;
        setResponseEventListener(callback: Function, thisObj?: any): void;
        private dispatchResponseEvent;
        get response(): any;
        /**
         * @private
         */
        private _responseType;
        /**
         * @private
         * 设置返回的数据格式，请使用 HttpResponseType 里定义的枚举值。设置非法的值或不设置，都将使用HttpResponseType.TEXT。
         */
        get responseType(): "" | "arraybuffer" | "blob" | "document" | "json" | "text";
        set responseType(value: "" | "arraybuffer" | "blob" | "document" | "json" | "text");
        /**
         * @private
         */
        private _withCredentials;
        /**
         * @private
         * 表明在进行跨站(cross-site)的访问控制(Access-Control)请求时，是否使用认证信息(例如cookie或授权的header)。 默认为 false。(这个标志不会影响同站的请求)
         */
        get withCredentials(): boolean;
        set withCredentials(value: boolean);
        /**
         * @private
         */
        private _url;
        private _method;
        /**
         * @private
         *
         * @returns
         */
        private getXHR;
        /**
         * @private
         * 初始化一个请求.注意，若在已经发出请求的对象上调用此方法，相当于立即调用abort().
         * @param url 该请求所要访问的URL该请求所要访问的URL
         * @param method 请求所使用的HTTP方法， 请使用 HttpMethod 定义的枚举值.
         */
        open(url: string, method?: string): void;
        /**
         * @private
         * 发送请求.
         * @param data 需要发送的数据
         */
        send(data?: any): void;
        /**
         * @private
         * 如果请求已经被发送,则立刻中止请求.
         */
        abort(): void;
        /**
         * @private
         * 返回所有响应头信息(响应头名和值), 如果响应头还没接受,则返回"".
         */
        getAllResponseHeaders(): string;
        private headerObj;
        /**
         * @private
         * 给指定的HTTP请求头赋值.在这之前,您必须确认已经调用 open() 方法打开了一个url.
         * @param header 将要被赋值的请求头名称.
         * @param value 给指定的请求头赋的值.
         */
        setRequestHeader(header: string, value: string): void;
        /**
         * @private
         * 返回指定的响应头的值, 如果响应头还没被接受,或该响应头不存在,则返回"".
         * @param header 要返回的响应头名称
         */
        getResponseHeader(header: string): string;
        /**
         * @private
         */
        private onTimeout;
        /**
         * @private
         */
        private onReadyStateChange;
        /**
         * @private
         */
        private updateProgress;
        /**
         * @private
         */
        private onload;
        /**
         * @private
         */
        private onerror;
    }
}
declare module uniSdk {
    class OppoPlatform {
        private BANNER_AD_POSID;
        private VIDEO_AD_POSID;
        private CUSTOM_AD_POSID;
        private BOX_BANNER_AD_POSID;
        private BOX_PORTAL_AD_POSID;
        private shortcutButton;
        private banner;
        private videoAd;
        private boxPortalAd;
        private boxBannerAd;
        private customAd;
        private videoAdLoading;
        private bannerAdShowed;
        private boxBannerAdShowed;
        private boxPortalAdShowed;
        private customAdShowed;
        showMaskLayer(): void;
        hideMaskLayer(): void;
        init(callback: any, thisObj: any): void;
        login(callback: any, thisObj: any, loginData: any): void;
        downloadResource(url: any, name: any, callback: any, callbackProgress: any, thisObj: any): void;
        showBannerAdvertisement(userData: any, callback: any, thisObj: any): void;
        hideBannerAdvertisement(userData: any): void;
        showInterstitialAdvertisement(userData: any, callback: any, thisObj: any): void;
        showNativeAdvertisement(userData: any, callback: any, thisObj: any): void;
        showVideoAdvertisement(userData: any, callback: any, thisObj: any): void;
        clearResCache(): void;
        private showShortcut;
        private hideShortcut;
        private destroyShortcut;
        private createBoxPortalAd;
        private showBoxPortalAd;
        private destroyBoxPortalAd;
        private createBoxAd;
        private destroyBoxAd;
        customInterface(funcName: any, userData: any, callback: any, thisObj: any): void;
    }
}
declare module uniSdk {
    class VivoPlatform {
        private BANNER_AD_POSID;
        private VIDEO_AD_POSID;
        private CUSTOM_AD_POSID;
        private BOX_BANNER_AD_POSID;
        private BOX_PORTAL_AD_POSID;
        private shortcutButton;
        private banner;
        private videoAd;
        private boxPortalAd;
        private boxBannerAd;
        private customAd;
        private videoAdLoading;
        private bannerAdShowed;
        private boxBannerAdShowed;
        private boxPortalAdShowed;
        showMaskLayer(): void;
        hideMaskLayer(): void;
        init(callback: any, thisObj: any): void;
        login(callback: any, thisObj: any, loginData: any): void;
        downloadResource(url: any, name: any, callback: any, callbackProgress: any, thisObj: any): void;
        showBannerAdvertisement(userData: any, callback: any, thisObj: any): void;
        hideBannerAdvertisement(userData: any): void;
        showInterstitialAdvertisement(userData: any, callback: any, thisObj: any): void;
        showNativeAdvertisement(userData: any, callback: any, thisObj: any): void;
        showVideoAdvertisement(userData: any, callback: any, thisObj: any): void;
        clearResCache(): void;
        private showShortcut;
        private hideShortcut;
        private destroyShortcut;
        private createBoxBannerAd;
        private showBoxBannerAd;
        private hideBoxBannerAd;
        private destroyBoxBannerAd;
        private createBoxPortalAd;
        private showBoxPortalAd;
        private hideBoxPortalAd;
        private destroyBoxPortalAd;
        private createBoxAd;
        private destroyBoxAd;
        customInterface(funcName: any, userData: any, callback: any, thisObj: any): void;
    }
}
declare module uniSdk {
    class XiaoMiPlatform {
        private BANNER_AD_POSID;
        private VIDEO_AD_POSID;
        private CUSTOM_AD_POSID;
        private BOX_BANNER_AD_POSID;
        private BOX_PORTAL_AD_POSID;
        private BOX_FLOAT_AD_POSID;
        private INTERST_AD_POSID;
        private banner;
        private videoAd;
        private boxPortalAd;
        private boxBannerAd;
        private interstitialAd;
        private videoAdLoading;
        private bannerAdShowed;
        private boxBannerAdShowed;
        private boxPortalAdShowed;
        private bannerTimestamp;
        showMaskLayer(): void;
        hideMaskLayer(): void;
        init(callback?: any, thisObj?: any): void;
        login(callback: any, thisObj: any, loginData: any): void;
        downloadResource(url: any, name: any, callback: any, callbackProgress: any, thisObj: any): void;
        showBannerAdvertisement(userData: any, callback: any, thisObj: any): void;
        hideBannerAdvertisement(userData: any): void;
        showInterstitialAdvertisement(userData: any, callback: any, thisObj: any): void;
        showNativeAdvertisement(userData: any, callback: any, thisObj: any): void;
        showVideoAdvertisement(userData: any, callback: any, thisObj: any): void;
        clearResCache(): void;
        private showShortcut;
        private hideShortcut;
        private destroyShortcut;
        /** 100: 九宫格   120:互推盒子横幅   150:悬浮球 */
        private displayAd;
        createBoxAd(): void;
        destroyBoxAd(): void;
        showBoxPortalAd(): void;
        hideBoxPortalAd(): void;
        /** 互推盒子-悬浮球 */
        showFloatAd(): void;
        hideFloatAd(): void;
        customInterface(funcName: any, userData: any, callback: any, thisObj: any): void;
    }
}
declare module uniSdk {
    class OPPO_AdBanner extends AdBanner {
        private adUnitId;
        private banner;
        private bannerLoading;
        private isShow;
        private createTimestamp;
        private showTime;
        private maxShowTime;
        private bannerWidth;
        constructor(unitId: string, bannerwidth: number);
        get id(): string;
        get isLoaded(): boolean;
        setShowTime(time: number): void;
        private createBannerAd;
        load(): void;
        private onBannerLoad;
        private onBannerResize;
        private onBannerError;
        show(force?: boolean): void;
        hide(): void;
        destroy(): void;
    }
}
declare module uniSdk {
    /**
     * 原生广告
     */
    class OPPO_AdCustom extends AdCustom {
        private adUnitId;
        private customAd;
        private adIndex;
        private state;
        private isShow;
        private closeCallback;
        private showCallback;
        private showCallbackTarget;
        constructor(unitId: string, index: number);
        private createCustomAd;
        load(): void;
        destroy(): void;
        show(callback?: Function, closeCallback?: Function, thisObj?: any): void;
        hide(): void;
        private onCustomLoad;
        private onCustomError;
        private onCustomClose;
        private onCustomHide;
    }
}
declare module uniSdk {
    class OPPO_AdInterstitial extends AdInterstitial {
        private adUnitId;
        constructor(unitId: string);
        get id(): string;
        get isLoaded(): boolean;
        show(callback?: Function, closeCallback?: Function, thisObj?: any): void;
        destroy(): void;
    }
}
declare module uniSdk {
    class OPPO_AdRewardedVideo extends AdRewardedVideo {
        private adUnitId;
        private videoAd;
        private callback;
        private callbackTarget;
        private showForLoading;
        constructor(unitIdList: string[]);
        get id(): string;
        private createRewardedVideoAd;
        private load;
        private onVideoLoad;
        private onVideoError;
        private onVideoClose;
        show(index: number, callback?: Function, thisObj?: any): void;
        destroy(): void;
    }
}
declare module uniSdk {
    class TT_AdBanner extends AdBanner {
        private adUnitId;
        private banner;
        private bannerLoading;
        private isShow;
        private createTimestamp;
        private showTime;
        private maxShowTime;
        private bannerWidth;
        constructor(unitId: string, bannerwidth: number);
        get id(): string;
        get isLoaded(): boolean;
        setShowTime(time: number): void;
        private createBannerAd;
        load(): void;
        private onBannerLoad;
        private onBannerResize;
        private onBannerError;
        show(force?: boolean): void;
        hide(): void;
        destroy(): void;
    }
}
declare module uniSdk {
    /**
     * 原生广告
     */
    class TT_AdCustom extends AdCustom {
        private adUnitId;
        private customAd;
        private state;
        private isShow;
        private closeCallback;
        private showCallback;
        private showCallbackTarget;
        private userStyle;
        constructor(unitId: string, index: number);
        private createCustomAd;
        load(): void;
        destroy(): void;
        show(callback?: Function, closeCallback?: Function, thisObj?: any): void;
        hide(): void;
        private onCustomLoad;
        private onCustomError;
        private onCustomClose;
        private onCustomHide;
    }
}
declare module uniSdk {
    class TT_AdInterstitial extends AdInterstitial {
        private adUnitId;
        private interstitial;
        private state;
        private isShow;
        private closeCallback;
        private showCallback;
        private showCallbackTarget;
        private createTimestamp;
        constructor(unitId: string);
        get id(): string;
        private createInterstitialAd;
        load(): void;
        private onInterstitialLoad;
        private onInterstitialError;
        private onInterstitialClose;
        show(callback?: Function, closeCallback?: Function, thisObj?: any): void;
        destroy(): void;
    }
}
declare module uniSdk {
    class TT_AdRewardedVideo extends AdRewardedVideo {
        private unitIdList;
        private adUnitId;
        private videoAd;
        private isShow;
        private callback;
        private callbackTarget;
        constructor(unitIdList: string[]);
        get id(): string;
        private createRewardedVideoAd;
        private load;
        private onVideoLoad;
        private onVideoError;
        private onVideoClose;
        show(index: number, callback?: Function, thisObj?: any): void;
        destroy(): void;
    }
}
declare module uniSdk {
    class VIVO_AdBanner extends AdBanner {
        private adUnitId;
        private banner;
        private bannerLoading;
        private isShow;
        private createTimestamp;
        private showTime;
        private maxShowTime;
        private bannerWidth;
        constructor(unitId: string, bannerwidth: number);
        get id(): string;
        get isLoaded(): boolean;
        setShowTime(time: number): void;
        private createBannerAd;
        load(): void;
        private onBannerLoad;
        private onBannerResize;
        private onBannerError;
        show(force?: boolean): void;
        hide(): void;
        destroy(): void;
    }
}
declare module uniSdk {
    /**
     * 原生广告
     */
    class VIVO_AdCustom extends AdCustom {
        private adUnitId;
        private customAd;
        private adIndex;
        private state;
        private isShow;
        private closeCallback;
        private showCallback;
        private showCallbackTarget;
        constructor(unitId: string, index: number);
        private createCustomAd;
        load(): void;
        destroy(): void;
        show(callback?: Function, closeCallback?: Function, thisObj?: any): void;
        hide(): void;
        private onCustomLoad;
        private onCustomError;
        private onCustomClose;
        private onCustomHide;
    }
}
declare module uniSdk {
    class VIVO_AdInterstitial extends AdInterstitial {
        private adUnitId;
        constructor(unitId: string);
        get id(): string;
        get isLoaded(): boolean;
        show(callback?: Function, closeCallback?: Function, thisObj?: any): void;
        destroy(): void;
    }
}
declare module uniSdk {
    class VIVO_AdRewardedVideo extends AdRewardedVideo {
        private adUnitId;
        private videoAd;
        private callback;
        private callbackTarget;
        private showForLoading;
        constructor(unitIdList: string[]);
        get id(): string;
        private createRewardedVideoAd;
        private load;
        private onVideoLoad;
        private onVideoError;
        private onVideoClose;
        show(index: number, callback?: Function, thisObj?: any): void;
        destroy(): void;
    }
}
declare module uniSdk {
    class WX_AdBanner extends AdBanner {
        private adUnitId;
        private banner;
        private isShow;
        private createTimestamp;
        private showTime;
        private maxShowTime;
        private bannerWidth;
        constructor(unitId: string, bannerwidth: number);
        get id(): string;
        get isLoaded(): boolean;
        setShowTime(time: number): void;
        private createBannerAd;
        load(): void;
        private onBannerLoad;
        private onBannerResize;
        private onBannerError;
        show(force?: boolean): void;
        hide(): void;
        destroy(): void;
    }
}
declare module uniSdk {
    /**
     * 原生广告
     */
    class WX_AdCustom extends AdCustom {
        private adUnitId;
        private customAd;
        private state;
        private isShow;
        private closeCallback;
        private showCallback;
        private showCallbackTarget;
        private userStyle;
        constructor(unitId: string, index: number);
        private createCustomAd;
        load(): void;
        destroy(): void;
        show(callback?: Function, closeCallback?: Function, thisObj?: any): void;
        hide(): void;
        private onCustomLoad;
        private onCustomError;
        private onCustomClose;
        private onCustomHide;
    }
}
declare module uniSdk {
    class WX_AdInterstitial extends AdInterstitial {
        private adUnitId;
        private interstitial;
        private state;
        private isShow;
        private closeCallback;
        private showCallback;
        private showCallbackTarget;
        private createTimestamp;
        constructor(unitId: string);
        get id(): string;
        get isLoaded(): boolean;
        private createInterstitialAd;
        load(): void;
        private onInterstitialLoad;
        private onInterstitialError;
        private onInterstitialClose;
        show(callback?: Function, closeCallback?: Function, thisObj?: any): void;
        destroy(): void;
    }
}
declare module uniSdk {
    class WX_AdRewardedVideo extends AdRewardedVideo {
        private unitIdList;
        private adUnitId;
        private videoAd;
        private callback;
        private callbackTarget;
        private showForLoading;
        constructor(unitIdList: string[]);
        get id(): string;
        private createRewardedVideoAd;
        private load;
        private onVideoLoad;
        private onVideoError;
        private onVideoClose;
        show(index: number, callback?: Function, thisObj?: any): void;
        destroy(): void;
    }
}
window.uniSdk=uniSdk;