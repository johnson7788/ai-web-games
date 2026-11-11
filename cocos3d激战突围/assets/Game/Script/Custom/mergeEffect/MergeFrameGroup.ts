import { _decorator, Component, Node, clamp01, v3, Vec3, v2, color, v4, Vec4 } from 'cc';
import { PhyParam, PhyInitParam } from './MergeGroup';
const { ccclass, property } = _decorator;

//模拟单个粒子计算
class MergeFrameItem {
    index = 0;
    isFinish = true;

    //----计算的参数
    lineSpd = v3();
    rotSpd = v3();
    scaleSpd = 0;
    opacitySpd = 0;

    //----传递的数据--占4个v4()-
    //位移
    pos = v3();
    //旋转
    rot = v3();
    // 缩放+透明度+激活开关
    scale = 0;
    opacity = 0;
    activeNum = 0; //0关 1开
    //动态UV
    curUvOffset = v2();
    curUvTime = 0;
    curFrameIndex = 1;
    curUvXCount = 0;    //当前水平切换行数

    //颜色
    curColor = v4();
    colMixRate = 0;

    //---参数
    param: PhyParam = null;
    //
    curt = 0;

    constructor(index: number, param: PhyParam) {
        this.param = param;
        this.index = index;
    }

    init() {
        this.reset();
    }

    reset() {
        this.lineSpd.set(this.param.lineSpd);
        this.rotSpd.set(this.param.rotSpd);
        this.scaleSpd = this.param.scaleSpd;
        this.opacitySpd = this.param.opacitySpd;
        this.pos.set(0, 0, 0);
        this.rot.set(0, 0, 0);
        this.curUvOffset.set(this.param.initUvOffset);
        this.curColor.set(this.param.initColor);
        //
        this.scale = 0;
        this.opacity = 0;
        this.isFinish = true;
        this.curt = 0;
        this.curUvTime = 0;
        this.curFrameIndex = 1;
        this.colMixRate = 0;
        this.curUvXCount = 0;
    }

    setActive(isActive: boolean, initPos: Vec3) {
        this.reset();
        this.activeNum = isActive ? 1 : 0;;
        this.pos.set(initPos); //初始位置
        this.isFinish = false;
        //
        this.scale = this.param.initScale;
        this.opacity = this.param.opacity;
    }

    tmpP = v3();
    tmpR = v3();
    tmpC1 = v4();
    tmpC2 = v4();

    update(dt) {
        this.calParam(dt);
    }

    calParam(dt) {
        if (this.isFinish) return;
        //位移速度
        this.tmpP.set(this.param.lineDamping).multiplyScalar(dt);
        this.lineSpd.add(this.tmpP);
        //位移
        this.tmpP.set(this.lineSpd).multiplyScalar(dt);
        this.pos.add(this.tmpP);
        //旋转速度
        this.tmpR.set(this.param.rotDamping).multiplyScalar(dt);
        this.rotSpd.add(this.tmpR);
        //旋转
        this.tmpR.set(this.rotSpd).multiplyScalar(dt);
        this.rot.add(this.tmpR);
        //缩放
        this.scale += this.scaleSpd * dt * this.activeNum;
        this.scale = this.scale < 0 ? 0 : this.scale;
        //透明度        
        this.opacity = clamp01(this.opacity + this.opacitySpd * dt);
        //计时器
        this.curt += dt;
        if (this.curt >= this.param.delayTime) {
            this.isFinish = true;;
        }

        //uv切换-先水平切换 再垂直切换
        if (this.curFrameIndex < this.param.maxFrame ||
            this.curFrameIndex >= this.param.maxFrame && this.param.uvLoop) {

            this.curUvTime += dt;
            if (this.curUvTime >= this.param.uvStepTime) {
                this.curUvTime = 0;
                this.curFrameIndex++;

                this.curUvOffset.x += this.param.uvOffsetStep.x;
                if (this.curUvOffset.x >= this.param.uvOffsetMax.x) {
                    this.curUvOffset.x = 0;
                    this.curUvXCount++;
                }
                this.curUvOffset.y = this.param.uvOffsetStep.y * this.curUvXCount;
                if (this.curUvOffset.y >= this.param.uvOffsetMax.y) {
                    this.curUvOffset.y = 0;
                    this.curUvXCount = 0;
                }                
            }
            // if (this.curFrameIndex >= this.param.maxFrame) {
            //    
            // }
        }

        //颜色
        this.colMixRate += this.param.colorSpd * dt;
        if (this.colMixRate > 1) {
            this.colMixRate = this.param.coloLoop ? 0 : 1;
        }
        this.tmpC1.set(this.param.initColor).multiplyScalar(1 - this.colMixRate);
        this.tmpC2.set(this.param.toColor).multiplyScalar(this.colMixRate);
        Vec4.add(this.curColor, this.tmpC1, this.tmpC2);
    }

}

@ccclass('MergeFrameGroup')
export class MergeFrameGroup {
    //对应传递v4数组的下标起始范围
    startIndex = 0;
    endIndex = 0;

    items: MergeFrameItem[] = [];
    initParam: PhyInitParam = null;
    isFinish = true;

    constructor(startIndex, endIndex, initParam: PhyInitParam) {
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.initParam = initParam;
        //创建item
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            let index = i;
            let param = this.getPhyParam(initParam);
            let item = new MergeFrameItem(index, param);
            this.items.push(item);
        }
    }
    //生成初始参数
    getPhyParam(param: PhyInitParam) {
        //速度浮动
        let lfv = v3(param.lineFloat).multiplyScalar(0.5);
        //旋转浮动
        let rfv = v3(param.rotFloat).multiplyScalar(0.5);
        //初始缩放浮动
        let sfv = param.scaleFloat * 0.5;

        //生成随机参数
        let p = new PhyParam();
        p.lineSpd.x = param.lineSpd.x + (2 * Math.random() - 1) * lfv.x;
        p.lineSpd.y = param.lineSpd.y + (2 * Math.random() - 1) * lfv.y;
        p.lineSpd.z = param.lineSpd.z + (2 * Math.random() - 1) * lfv.z;
        p.lineDamping.set(param.lineDamping);
        //
        p.rotSpd.x = param.rotSpd.x + (2 * Math.random() - 1) * rfv.x;
        p.rotSpd.y = param.rotSpd.y + (2 * Math.random() - 1) * rfv.y;
        p.rotSpd.z = param.rotSpd.z + (2 * Math.random() - 1) * rfv.z;
        //
        p.initScale = param.initScale + (2 * Math.random() - 1) * sfv;
        p.scaleSpd = param.scaleSpd;
        //
        p.opacity = param.opacity;
        p.opacitySpd = param.opacitySpd;
        //
        p.delayTime = param.delayTime;
        //uv
        p.uvOffsetMax.set(param.uvOffsetMax);
        p.uvOffsetStep.set(param.uvOffsetStep);
        p.uvStepTime = param.uvStepTime;
        p.initUvOffset.set(param.initUvOffset);
        p.uvLoop = param.uvLoop;
        p.maxFrame = param.maxFrame;
        //color
        p.colorSpd = param.colorSpd;
        p.initColor.set(param.initColor);
        p.toColor.set(param.toColor);
        p.coloLoop = param.coloLoop;

        return p;
    }

    setActive(isActive: boolean, initPos: Vec3) {
        this.isFinish = false;
        for (let i = 0; i < this.items.length; i++) {
            const e = this.items[i];
            e.setActive(isActive, initPos);
        }
    }

    init() {
        for (let i = 0; i < this.items.length; i++) {
            const e = this.items[i];
            e.init();
        }
    }

    reset() {
        this.isFinish = true;
        for (let i = 0; i < this.items.length; i++) {
            const e = this.items[i];
            e.reset();
        }
    }

    update(dt) {
        let isFinish = true;
        for (let i = 0; i < this.items.length; i++) {
            const e = this.items[i];
            e.update(dt);
            isFinish = isFinish && e.isFinish;
        }
        this.isFinish = isFinish;
        if (this.isFinish) {
            this.reset();
        }
    }

}

