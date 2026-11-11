import { _decorator, Component, Node, Enum, Label, UIOpacity } from 'cc';
import { GlobalConfig } from '../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../Init/Config/GlobalEnum';
import EventManager from '../../Init/Managers/EventManager';
import { EventTypes } from '../../Init/Managers/EventTypes';
import { AudioEnum } from '../../Init/SystemAudio/AudioEnum';
import { AudioSystem } from '../../Init/SystemAudio/AudioSystem';
import { PlatformType, SDKSystem } from '../../Init/SystemSDK/SDKSystem';
import { StorageSystem } from '../../Init/SystemStorage/StorageSystem';
import { UIEnum } from '../../Init/SystemUI/UIEnum';
import { UISystem } from '../../Init/SystemUI/UISystem';
const { ccclass, property } = _decorator;
export enum LvupPropType {
    RoleNum,
    GoldRate,
    Gaint
}
@ccclass('lvupPropCmp')
export class lvupPropCmp extends Component {
    @property({ type: Enum(LvupPropType) })
    propType: LvupPropType = LvupPropType.RoleNum;

    @property(Label)
    propLabel: Label = null;

    @property(Label)
    costLabel: Label = null;

    addNum = 0;
    propNum = 0;
    costNum = 0;
    _isVideo = false;
    _isHideVideoIco = false;

    _opacityCmp: UIOpacity = null;

    onLoad() {
        this._opacityCmp = this.node.getComponent(UIOpacity);
        if (!this._opacityCmp) {
            this._opacityCmp = this.node.addComponent(UIOpacity);
            this._opacityCmp.opacity = 255;
        }

        EventManager.on(EventTypes.GameEvents.UserAssetsChanged, this.freshData, this);
    }

    onEnable() {
        this._opacityCmp.opacity = 255;
        this.setData();
    }

    setData() {
        const _cfg = GlobalConfig.RolePropCfg;
        let d = StorageSystem.getData();
        let isMax = false;
        switch (this.propType) {
            case LvupPropType.RoleNum:
                this.propNum = _cfg.getRoleNumByLv(d.userAssets.props.RoleNumLv);
                this.costNum = _cfg.getRoleNumCostByLv(d.userAssets.props.RoleNumLv);

                this.propLabel.string = this.propNum.toFixed(0);
                this.costLabel.string = this.costNum.toFixed(0);

                if (d.userAssets.props.RoleNumLv >= _cfg.goldRate.maxLv) {
                    isMax = true;
                }
                break;
            case LvupPropType.GoldRate:
                this.propNum = d.userAssets.props.GoldRateLv;
                this.costNum = _cfg.getGoldRateCostByLv(d.userAssets.props.GoldRateLv);

                this.propLabel.string = this.propNum.toFixed(0);
                this.costLabel.string = this.costNum.toFixed(0);

                if (d.userAssets.props.GoldRateLv >= _cfg.goldRate.maxLv) {
                    isMax = true;
                }
                break;
            case LvupPropType.Gaint:
                this.propNum = d.userAssets.props.GiantLv;
                this.costNum = _cfg.getBossCostByLv(d.userAssets.props.GiantLv);

                if (d.userAssets.props.GiantLv >= _cfg.bossInfo.maxLv) {
                    isMax = true;
                }
                this.propLabel.string = this.propNum.toFixed(0);
                this.costLabel.string = this.costNum.toFixed(0);
                break;
            default:
                break;
        }
        //切换视频图标
        this._isVideo = this.costNum > d.userAssets.asset;
        let gold = this.node.getChildByName('gold');
        let video = this.node.getChildByName('videoIco');

        gold.active = !isMax && !this._isVideo;
        video.active = this._isVideo;
    }

    onClick() {
        const _cfg = GlobalConfig.RolePropCfg;
        let data = StorageSystem.getData();

        switch (this.propType) {
            case LvupPropType.RoleNum:
                if (this.propNum >= _cfg.roleNum.maxLv) {
                    //弹出提示
                    EventManager.emit(EventTypes.GameEvents.ShowTips, '已达最大等级!');
                    return;
                }
                if (data.userAssets.asset < this.costNum) {
                    //视频
                    this.randomPop(this.propType, () => {
                        StorageSystem.setData((d) => {
                            d.userAssets.props.RoleNumLv++;
                        }, true);
                        EventManager.emit(EventTypes.RoleEvents.AddRoles, GlobalEnum.IncreaseType.symbol_Add, 1);
                        this.freshData();
                        AudioSystem.playEffect(AudioEnum.lvupProp);
                    })
                } else {
                    StorageSystem.setData((d) => {
                        d.userAssets.props.RoleNumLv++;
                        d.userAssets.asset -= this.costNum;
                    }, true);

                    StorageSystem.updateToAssets();
                    AudioSystem.playEffect(AudioEnum.lvupProp);
                    EventManager.emit(EventTypes.RoleEvents.AddRoles, GlobalEnum.IncreaseType.symbol_Add, 1);
                }
                break
            case LvupPropType.GoldRate:
                if (this.propNum >= _cfg.goldRate.maxLv) {
                    //弹出提示
                    EventManager.emit(EventTypes.GameEvents.ShowTips, '已达最大等级!');
                    return;
                }

                if (data.userAssets.asset < this.costNum) {
                    //视频
                    this.randomPop(this.propType, () => {
                        StorageSystem.setData((d) => {
                            d.userAssets.props.GoldRateLv++;
                        }, true);

                        this.freshData();
                        AudioSystem.playEffect(AudioEnum.lvupProp);
                    })

                } else {
                    StorageSystem.setData((d) => {
                        d.userAssets.props.GoldRateLv++;
                        d.userAssets.asset -= this.costNum;
                    }, true);

                    StorageSystem.updateToAssets();
                    AudioSystem.playEffect(AudioEnum.lvupProp);
                }

                break;
            case LvupPropType.Gaint:
                if (this.propNum >= _cfg.bossInfo.maxLv) {
                    //弹出提示
                    EventManager.emit(EventTypes.GameEvents.ShowTips, '已达最大等级!');
                    return;
                }

                if (data.userAssets.asset < this.costNum) {
                    //视频
                    this.randomPop(this.propType, () => {
                        StorageSystem.setData((d) => {
                            d.userAssets.props.GiantLv++;
                        }, true);

                        AudioSystem.playEffect(AudioEnum.lvupProp);
                        EventManager.emit(EventTypes.RoleEvents.LvupGaint);
                        this.freshData();
                    })
                } else {
                    StorageSystem.setData((d) => {
                        d.userAssets.props.GiantLv++;
                        d.userAssets.asset -= this.costNum;
                    }, true);

                    StorageSystem.updateToAssets();
                    AudioSystem.playEffect(AudioEnum.lvupProp);
                    EventManager.emit(EventTypes.RoleEvents.LvupGaint);
                }
                break;
            default:
                break;
        }

    }

    freshData() {
        if (!this.node.activeInHierarchy) return;
        this.setData();
    }

    //#region --------------------广告-------------------------

    //金币不足时
    private randomPop(type, successCb) {
        switch (SDKSystem._curPlatform) {
            case PlatformType.PCMiniGame:
            case PlatformType.WXMiniGame:
                this.WxPop(type, successCb);
                break;
            case PlatformType.TTMiniGame:
                this.TTPop(type, successCb);
                break;
            case PlatformType.OPPOMiniGame:
            case PlatformType.VIVOMiniGame:
                this.OVPop(type, successCb);
                break;
            default:
                break;
        }
    }

    private OVPop(type, successCb) {
        this._isHideVideoIco = false;
        //观看视频
        EventManager.emit(EventTypes.SDKEvents.ShowVideo, {
            success: () => {
                //观看视频成功
                successCb && successCb();
            },
            fail: () => {
                this._isHideVideoIco = false;
                this.setData();
            },
            cancel: () => {
                this._isHideVideoIco = false;
                this.setData();
            },
        })
    }

    private TTPop(type, successCb) {
        this._isHideVideoIco = false;
        //观看视频
        EventManager.emit(EventTypes.SDKEvents.ShowVideo, {
            success: () => {
                //观看视频成功
                successCb && successCb();
            },
            fail: () => {
                this._isHideVideoIco = false;
                this.setData();
            },
            cancel: () => {
                this._isHideVideoIco = false;
                this.setData();
            },
        })
    }

    private WxPop(type, successCb) {
        this._isHideVideoIco = false;
        //观看视频
        EventManager.emit(EventTypes.SDKEvents.ShowVideo, {
            success: () => {
                //观看视频成功
                successCb && successCb();
            },
            fail: () => {
                this._isHideVideoIco = false;
                this.setData();
            },
            cancel: () => {
                this._isHideVideoIco = false;
                this.setData();
            },
        }, 2);
    }

    //#endregion
}
