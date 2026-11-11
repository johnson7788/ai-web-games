import { AudioClip, AudioSource, warn, Node } from "cc";
import { BasicSystem } from "../Basic/BasicSystem";
import { GlobalTmpData } from "../Config/GlobalTmpData";
import { StorageSystem } from "../SystemStorage/StorageSystem";
import Loader from "../Tools/Loader";
import { AudioEnum } from "./AudioEnum";

export class AudioSystem extends BasicSystem {
    //音频开关
    public static audioSwitch = { Effects: true, Bgm: true };

    /**音效资源 */
    protected static allClips: { [key: string]: AudioClip } = {};

    protected static loopClips: AudioEnum[] = [];
    protected static bgmAudioSource: AudioSource = null;
    protected static bgmAudioSourceNode: Node = null;
    protected static effectAudioSource: AudioSource = null;
    protected static effectAudioSourceNode: Node = null;
    //
    private static audioBound = 'AudioAssets';

    public static init() {
        if (this.isInit) return;
        this.isInit = true;
        //创建挂载节点
        if (!this.bgmAudioSourceNode) {
            this.bgmAudioSourceNode = new Node('bgmAudioSourceNode');
            this.bgmAudioSource = this.bgmAudioSourceNode.addComponent(AudioSource);
            this.bgmAudioSource.playOnAwake = false;
        }
        if (!this.effectAudioSourceNode) {
            this.effectAudioSourceNode = new Node('effectAudioSourceNode');
            this.effectAudioSource = this.effectAudioSourceNode.addComponent(AudioSource);
            this.effectAudioSource.playOnAwake = false;
        }
        this.onEvents();
        //获取配置
        let d = StorageSystem.getData();
        this.audioSwitch.Effects = d.userSetting.AudioSwith;
        this.audioSwitch.Bgm = d.userSetting.AudioSwith;

        this.isInitFinished = true;
    }
    protected static onEvents() {

    }

    //#region ------------开关------------
    //开启 / 关闭音频
    public static setAudioState(isOpen) {
        if (isOpen) {
            this.audioSwitch.Bgm = true;
            this.audioSwitch.Effects = true;
            this.playBGM(this.curBGM);
        } else {
            this.audioSwitch.Bgm = false;
            this.audioSwitch.Effects = false;
            this.stopBGM();
            this.stopEffect();
        }
    }

    //#endregion 

    //#region ------------音效----------------
    public static _limitCd = 1 / 10;
    public static limitTimeRec: { [clip: string]: number } = {};
    /**同一种音效 时间 频率控制**/
    public static playEffectLimit(clip: AudioEnum, d?: { isLoop: boolean, volume?: number }) {
        let curT = Date.now();
        if (!this.limitTimeRec[clip]) {
            this.limitTimeRec[clip] = 0;
        }
        let _lastTime = this.limitTimeRec[clip];
        this.limitTimeRec[clip] = curT;
        if (curT - _lastTime > this._limitCd * 1000) {
            this.playEffect(clip, d);
        }
    }

    public static _limitCount = 10; // 10/s
    public static limitTimeRec2: { [clip: string]: { n: number, t: number } } = {};
    /**同一种音效 次数 频率控制**/
    public static playEffectLimit2(clip: AudioEnum, d?: { isLoop: boolean, volume?: number }) {
        let curT = Date.now();
        if (!this.limitTimeRec2[clip]) {
            this.limitTimeRec2[clip] = { n: 0, t: curT };
        }

        let subT = curT - this.limitTimeRec2[clip].t;

        if (subT > 1000) {
            this.limitTimeRec2[clip].t = curT;
            this.limitTimeRec2[clip].n = 0;
        }

        if (subT < 1000 && this.limitTimeRec2[clip].n < this._limitCount) {
            this.limitTimeRec2[clip].n++;
            this.playEffect(clip, d);
        }

    }

    /**播放音效 对外接口*/
    public static playEffect(clip: AudioEnum, d?: { isLoop: boolean, volume?: number }) {
        if (GlobalTmpData.Game.isPause) return;
        if (undefined == d) {
            d = { isLoop: false, volume: 1 };
        } else {
            if (undefined == d.isLoop) {
                d.isLoop = false;
            }
            if (undefined == d.volume) {
                d.volume = 1;
            }
            if (d.isLoop && this.loopClips.indexOf(clip) < 0) {
                this.loopClips.push(clip);
            }
        }

        if (undefined === this.allClips[clip]) {
            Loader.loadBundle(this.audioBound, () => {
                Loader.loadBundleRes(this.audioBound, clip, (res) => {
                    if (!res) {
                        this.allClips[clip] = null;
                        warn("要播放的音效资源未找到：", clip);
                        return;
                    }
                    this.allClips[clip] = res;
                    this._playEffect(clip, d.isLoop, d.volume);
                }, false);
            }, false);
        } else {
            this._playEffect(clip, d.isLoop, d.volume);
        }
    }
    /**播放音效 */
    private static _playEffect(clip: AudioEnum, isLoop = false, volume = 1) {
        if (!this.audioSwitch.Effects) return;
        if (null === this.allClips[clip]) return;
        let c = this.allClips[clip];

        if (!isLoop) {
            this.effectAudioSource.playOneShot(c, volume);
        } else {
            this.effectAudioSource.clip = c;
            this.effectAudioSource.loop = true;
            this.effectAudioSource.play();
        }
    }
    /**停止音效 */
    protected static stopEffect(clip?: AudioEnum) {
        this.effectAudioSource.stop();

        if (clip && this.allClips[clip]) {
            let index = this.loopClips.indexOf(clip);
            if (index >= 0) {
                this.loopClips.splice(index, 1);
            }
        }
    }
    //#endregion

    //#region ------------BGM------------------
    protected static curBGM: AudioEnum = null;
    /**播放/切换 BGM 对外接口*/
    public static playBGM(clip: AudioEnum) {
        if (!clip) return;

        if (this.audioSwitch.Bgm && this.curBGM &&
            this.curBGM == clip && this.allClips[this.curBGM]) {

            let c = this.allClips[this.curBGM];
            this.bgmAudioSource.clip = c;
            this.bgmAudioSource.loop = true;
            if (this.bgmAudioSource.state != 1) {
                this.bgmAudioSource.play();
            }
            return;
        }

        if (undefined === this.allClips[clip]) {
            Loader.loadBundle(this.audioBound, () => {
                Loader.loadBundleRes(this.audioBound, clip, (res) => {
                    if (!res) {
                        this.allClips[clip] = null;
                        warn("要播放的音效资源未找到：", clip);
                        return;
                    }
                    this.allClips[clip] = res;
                    this._playBGM(clip);
                }, false);
            }, false);
        } else {
            this._playBGM(clip);
        }
    }
    private static _playBGM(clip: AudioEnum) {
        if (!this.audioSwitch.Bgm) return;
        if (null === this.allClips[clip]) return;
        if (!!this.curBGM) {
            this.bgmAudioSource.stop();
        }
        let c = this.allClips[clip];
        this.bgmAudioSource.clip = c;
        this.bgmAudioSource.loop = true;
        this.curBGM = clip;
        this.bgmAudioSource.play();
    }
    //停止BGM
    public static stopBGM() {
        if (!!this.curBGM) {
            this.bgmAudioSource.stop();
        }
    }
    //暂停BGM
    public static pauseBGM() {
        if (!!this.curBGM) {
            this.bgmAudioSource.pause();
        }
    }
    //继续BGM
    public static resumeBGM() {
        if (!this.audioSwitch.Bgm) return;
        if (!!this.curBGM) {
            this.bgmAudioSource.play();
        }
    }
    //#endregion

    //#region ------------事件----------------------
    protected static onLevelInit() {
        this.loopClips = [];
    }
    protected static onGameOver() {
        for (let i = this.loopClips.length - 1; i >= 0; i--) {
            const e = this.loopClips[i];
            this.stopEffect(e);
        }
    }
    //#endregion

}

