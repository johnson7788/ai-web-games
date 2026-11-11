import { Quat, sp, v3, v4, Vec3, Vec4 } from "cc";
import { TrailMesh } from "./TrailMesh";
export class TrailRec {
    trailId = 0;
    colorType = 0;
    //追随点
    posLen = 0;
    posArr: Vec3[] = [];
    rotArr: Vec4[] = [];
    spd = 0.1;
    followPos: Vec3 = null;
    //
    isUsed = false;
    msCmp: TrailMesh = null;
    constructor(index, length, msCmp: TrailMesh) {
        this.msCmp = msCmp;
        //追随点数量比分割的面片数量多1
        this.posLen = length + 1;
        for (let i = 0; i < this.posLen; i++) {
            this.posArr.push(v3());
            this.rotArr.push(v4());
        }
        this.trailId = index;
    }
    reset() {
        this.isUsed = false;
        //取消引用
        this.followPos = null;
        for (let i = 0; i < this.posArr.length; i++) {
            const p = this.posArr[i];
            p.set(Vec3.ZERO);
        }
        for (let n = 0; n < this.rotArr.length; n++) {
            const r = this.rotArr[n];
            r.set(Vec4.ZERO);
        }
        this.colorType = 0;
    }

    //激活
    setActive(colorType: number, followPos: Vec3, spd?: number) {
        if (undefined !== spd && spd > 0) {
            this.spd = spd;
        }
        this.colorType = colorType || 0;
        this.isUsed = true;
        this.followPos = followPos;

        //设置初始位置+旋转
        for (let i = 0; i < this.posLen; i++) {
            this.posArr[i].set(followPos);
            this.rotArr[i].set(0);
        }
    }
    //回收
    setReuse() {
        this.reset();
        this.msCmp.onUnuseTrail(this);
    }

    tmpPos = v3();
    subPos = v3();
    curDirec = v3();
    update(dt) {
        if (!this.isUsed) return;
        if (this.followPos.y < 0) {
            this.setReuse();
            return;
        }

        this.tmpPos.set(this.followPos);

        for (let i = 0; i < this.posArr.length; i++) {
            const p = this.posArr[i];
            if (i == 0) {
                p.set(this.tmpPos);
                Vec3.subtract(this.subPos, this.posArr[i + 1], this.posArr[i]);
            } else {
                p.lerp(this.tmpPos, this.spd);
                //-----根据前一个点和后一个点 计算当前点的旋转
                if (this.posArr[i + 1]) {
                    Vec3.subtract(this.subPos, this.posArr[i + 1], this.posArr[i - 1]);
                } else {
                    Vec3.subtract(this.subPos, this.posArr[i], this.posArr[i - 1]);
                }
            }
            //Y旋转角度
            // this.rotArr[i].x = Math.atan2(-this.subPos.z, this.subPos.x) - 1.57;

            //Z旋转角度
            this.rotArr[i].x = Math.atan2(this.subPos.y, this.subPos.x)- 1.57;

            this.tmpPos.set(p);
        }
    }

}
