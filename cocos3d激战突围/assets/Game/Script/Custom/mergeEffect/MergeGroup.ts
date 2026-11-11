import { _decorator, Component, Node, v3, v2, v4, Vec2, Vec3, clamp01, color } from 'cc';
const { ccclass, property } = _decorator;

//模拟单个粒子计算
class MergeItem {
    index = 0;
    isFinish = true;

    //----计算的参数
    lineSpd = v3();
    rotSpd = v3();
    scaleSpd = 0;
    opacitySpd = 0;

    //----传递的数据--占2个v4()-
    //位移
    pos = v3();
    //旋转-角度
    rot = v3();
    // 缩放+透明度+激活开关
    scale = 0;
    opacity = 0;
    activeNum = 0; //0关 1开

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
        //
        this.scale = 0;
        this.opacity = 0;
        this.isFinish = true;
        this.curt = 0;

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

    }

}

@ccclass('MergeGroup')
export class MergeGroup {
    //对应传递v4数组的下标起始范围
    startIndex = 0;
    endIndex = 0;

    items: MergeItem[] = [];
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
            let item = new MergeItem(index, param);
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


//用于实际计算的参数
export class PhyParam {
    //位移
    lineSpd = v3();
    lineDamping = v3();
    //旋转
    rotSpd = v3();
    rotDamping = v3();
    //缩放
    initScale = 1;
    scaleSpd = 0;

    //透明度(0~1)
    opacity = 1;
    opacitySpd = 0;
    //
    delayTime = 0;

    // frameAnim 参数
    initUvOffset = v2(); //切换第一帧位置
    uvOffsetMax = v2();  //最后一帧位置
    uvOffsetStep = v2();
    uvStepTime = 0.1;
    uvLoop = false; //uv是否循环
    maxFrame = 1;   //帧数
    // frameAnim 颜色
    initColor = v4();
    toColor = v4();
    colorSpd = 0.5; //变化速度比例 /秒
    coloLoop = false; //颜色是否循环
}


//用于随机计算的参数
export class PhyInitParam extends PhyParam {
    static _PhyInitParamId = 0;
    ParamId = 0;
    constructor() {
        super();
        this.ParamId = PhyInitParam._PhyInitParamId++;
    }

    //-----随机参数---
    lineFloat = v3();
    rotFloat = v3();
    scaleFloat = 0;
}
