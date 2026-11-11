import { _decorator, Node, SkeletalAnimation, AnimationClip } from 'cc';
import { GlobalTmpData } from '../../../../Init/Config/GlobalTmpData';
import { clog } from '../../../../Init/Tools/ColorLog';
const { ccclass, property } = _decorator;

@ccclass('BasicSkeleAnim')
export class BasicSkeleAnim {
    anim: SkeletalAnimation = null;
    _curClip: string = null;
    //
    _allClips: { [name: string]: AnimationClip } = {};
    /**当前动画播放时对应的时间缩放系数 */
    _curAnimtimeScale = 1.0;
    /**记录所有clip的初始速度 */
    _clipInitSpd: { [name: string]: number } = null;

    //当前动画额外的速度
    _extralAnimSpd = 1.0;

    //过度时长
    _crossTime = 0.2;

    constructor(skeleNode: Node) {
        this.anim = skeleNode.getComponent(SkeletalAnimation);
    }
    init(d?) {
        for (const key in this.anim.clips) {
            this._allClips[this.anim.clips[key].name] = this.anim.clips[key];
        }
        this.anim.stop();
        this.setInitClipSpd();
        this.onEvents();
    }

    onEvents() {

    }
    offEvents() {

    }
    reset() {
        this._curClip = null;
        this._curAnimtimeScale = 1.0;
        this._extralAnimSpd = 1;
        this.anim.stop();
        //设置为初始速度
        this.resetClipSpd();
        this.offEvents();
    }

    //记录所有clip的初始速度
    setInitClipSpd() {
        if (this._clipInitSpd) return;
        
        for (const key in this.anim.clips) {
            const clip = this.anim.clips[key];
            const state = this.anim.getState(clip.name);
            if (state) {
                if (!this._clipInitSpd) {
                    this._clipInitSpd = {};
                }
                this._clipInitSpd[clip.name] = state.speed || 1;
            }
        }
    }
    //恢复所有clip的初始速度
    resetClipSpd() {
        if (!this._clipInitSpd) return;

        for (const key in this.anim.clips) {
            const clip = this.anim.clips[key];
            const state = this.anim.getState(clip.name);

            if (clip && state && this._clipInitSpd[clip.name]) {
                state.speed = this._clipInitSpd[clip.name];
            }
        }
    }

    /**播放动画 */
    playAnim(clipName: string, isRandom = false, isForth = false, spdRate = 1.0, cb?) {
        if (!isForth && clipName == this._curClip) return;
        this.setInitClipSpd();

        if (!this._clipInitSpd || !this._clipInitSpd[clipName]) {
            clog.warn('没有' + clipName + '动作：', this.anim.node.name);
            return;
        };

        this._curClip = clipName;
        //设定播放速度
        this._extralAnimSpd = spdRate;
        this._curAnimtimeScale = GlobalTmpData.timeScale * spdRate;
        let state = this.anim.getState(clipName);
        state.speed = this._clipInitSpd[clipName] * this._curAnimtimeScale;

        cb && this.anim.once(SkeletalAnimation.EventType.FINISHED, cb);

        //动作融合         
        this.anim.crossFade(clipName, this._crossTime);

        //随机播放进度
        if (isRandom) {
            let sumTime = state.duration;
            state.setTime(sumTime * Math.random());
            state.sample();
        }
    }
}

