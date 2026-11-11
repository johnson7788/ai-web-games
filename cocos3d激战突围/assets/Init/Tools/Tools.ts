import { Vec2, Vec3, Vec4, v4, v3, v2, Size, Sprite, UITransform, size, Color, Intersection2D } from "cc";

export default class Tools {

    /**
     * 四舍五入 数值
     * @param num 
     * @param n 
     */
    public static roundNum(num: number, n: number): number {
        let str = num.toFixed(n);
        if (n > 0) {
            return parseFloat(str);
        } else {
            return parseInt(str);
        }
    }
    /**
     * 四舍五入 坐标
     * @param vec 
     * @param n 
     */
    public static roundVec(vec: Vec2 | Vec3 | Vec4, n: number): Vec2 | Vec3 | Vec4 {
        let v = vec as any;
        if (v.w != undefined) {
            return v4(this.roundNum(v.x, n), this.roundNum(v.y, n), this.roundNum(v.z, n), this.roundNum(v.w, n));
        } else if (v.z != undefined) {
            return v3(this.roundNum(v.x, n), this.roundNum(v.y, n), this.roundNum(v.z, n));
        } else {
            return v2(this.roundNum(v.x, n), this.roundNum(v.y, n));
        }
    }
    public static getMinAngle(ang: number) {
        let n = ang >= 0 ? 1 : -1;
        let angle = Math.abs(ang) % 360;
        let tmpAng = 360 - angle;

        if (angle > tmpAng) {
            return tmpAng * n;
        } else {
            return angle * n;
        }
    }

    public static convertToString(v: number) {
        if (v < 1100) return v.toString();
        if (v < 1000000) return (v * 0.001).toFixed(1) + "K";
        return (v * 0.000001).toFixed(1) + "M";
    }
    /**秒换成分显示 60min以内 显示00:00*/
    public static getMinByScend(num: number, out?): { min: string, scend: string } {
        if (!num || num < 0) return { min: "00", scend: "00" };
        num = Math.ceil(num);
        let min = 0;
        let scend = num;
        if (scend >= 60) {
            min = Math.floor(scend / 60);
            scend = scend % 60;
        }
        let minStr = min >= 10 ? "" + min : "0" + min;
        let scendStr = scend >= 10 ? "" + scend : "0" + scend;
        if (out) {
            out.min = minStr;
            out.scend = scendStr;
        }
        return out;
    }
    /**秒换成分显示 60min以内 */
    public static getMinByScend2(num: number): { min: string, scend: string } {
        if (!num || num < 0) return { min: "0", scend: "0" };
        num = Math.ceil(num);
        let min = 0;
        let scend = num;
        if (scend >= 60) {
            min = Math.floor(scend / 60);
            scend = scend % 60;
        }
        let minStr = "" + min;
        let scendStr = "" + scend;
        return { min: minStr, scend: scendStr };
    }
    /**秒换成分显示 60min以内 显示00:00:00*/
    public static getTimeByScend(num: number): { hour: string, min: string, scend: string } {
        if (!num || num < 0) return { hour: '00', min: "00", scend: "00" };
        num = Math.ceil(num);
        let hour = 0;
        let min = 0;
        let scend = num;

        hour = Math.floor(num / 3600);
        min = Math.floor(num / 60) - hour * 60;
        scend = num - hour * 3600 - min * 60;

        let hourStr = hour >= 10 ? "" + hour : "0" + hour;
        let minStr = min >= 10 ? "" + min : "0" + min;
        let scendStr = scend >= 10 ? "" + scend : "0" + scend;

        return { hour: hourStr, min: minStr, scend: scendStr };

    }


    /**size缩放到指定尺寸以下, isSame:是否缩放到指定值*/
    public static scaleSize(size: Size, maxnum: number, isSame = false) {
        if (!isSame && size.width <= maxnum && size.height <= maxnum) return size;

        let rate = 1;
        if (size.width > size.height) {
            rate = maxnum / size.width;
            size.height = rate * size.height;
            size.width = maxnum;
        } else {
            rate = maxnum / size.height;
            size.width = rate * size.width;
            size.height = maxnum;
        }
        return size;
    }
    /**图片缩放到指定尺寸 */
    public static scaleSprite(sp: Sprite, max) {
        sp.sizeMode = Sprite.SizeMode.TRIMMED;
        let trans = sp.node.getComponent(UITransform);
        let _s = size(trans.contentSize);
        Tools.scaleSize(_s, max, true);
        trans.setContentSize(_s);
    }
    /**图片缩放到指定高度 */
    public static scaleSpriteByHeight(sp: Sprite, maxHeight) {
        sp.sizeMode = Sprite.SizeMode.TRIMMED;
        let trans = sp.node.getComponent(UITransform);
        let _size = size(trans.contentSize);

        let rate = 1;
        rate = maxHeight / _size.height;
        _size.width = rate * _size.width;
        _size.height = maxHeight;

        trans.setContentSize(_size);
    }
    /**图片缩放到指定宽度 */
    public static scaleSpriteByWidth(sp: Sprite, maxWidth) {
        sp.sizeMode = Sprite.SizeMode.TRIMMED;
        let trans = sp.node.getComponent(UITransform);
        let _size = size(trans.contentSize);

        let rate = 1;
        rate = maxWidth / _size.width;
        _size.height = rate * _size.height;
        _size.width = maxWidth;

        trans.setContentSize(_size);
    }

    /**创建 贝塞尔曲线 */
    public static createBezierPoints(anchorpoints: Vec2[], pointsAmount: number): Vec2[] {
        var points = [];
        for (var i = 0; i < pointsAmount; i++) {
            var point = this.multiPointBezier(anchorpoints, i / pointsAmount);
            points.push(point);
        }
        return points;
    }

    private static multiPointBezier(points, t) {
        var len = points.length;
        var x = 0, y = 0;
        var erxiangshi = function (start, end) {
            var cs = 1, bcs = 1;
            while (end > 0) {
                cs *= start;
                bcs *= end;
                start--;
                end--;
            }
            return (cs / bcs);
        };
        for (var i = 0; i < len; i++) {
            var point = points[i];
            x += point.x * Math.pow((1 - t), (len - 1 - i)) * Math.pow(t, i) * (erxiangshi(len - 1, i));
            y += point.y * Math.pow((1 - t), (len - 1 - i)) * Math.pow(t, i) * (erxiangshi(len - 1, i));
        }
        return { x: x, y: y };
    }

    /**获取抛物线轨迹*/
    public static getShadowPath(linearVelocity: Vec3, startPos: Vec3, posNum: number, gravity = v2(0, -10)) {
        let list = [];
        const dt = 0.04;
        for (let i = 0; i < posNum; i++) {
            const time = dt * i;
            const dx = startPos.x + linearVelocity.x * time;
            // s = v_x * t
            const dz = startPos.z + linearVelocity.z * time;
            // h = v_y * t + 0.5 * a * t * t
            const dy = startPos.y + linearVelocity.y * time +
                0.5 * gravity.y * time * time;
            // 当前时间点坐标
            list.push(v3(dx, dy, dz))
        }

        return list;
    }

    /**
  * 获取除了 exceptLv 的随机数
  * @param maxLv//包含
  * @param exceptLv 
  */
    public static getRandomNum(maxLv, exceptLv: number): number {
        if (maxLv == exceptLv) return 1;
        let randLv = exceptLv;
        do {
            randLv = Math.floor(Math.random() * maxLv) + 1;
        } while (randLv == exceptLv);

        return randLv;
    }
    /**
     * 获取数字数组
     * @param min 包含
     * @param max 包含
     */
    public static getNumArr(min: number, max: number): number[] {
        let o = [];
        for (let index = min; index <= max; index++) {
            o.push(index);
        }
        return o;
    }

    /**
     * 返回数组中的随机数
     * @param inArr 
     * @param len 
     */
    public static getRandomNumFromArr(inArr: number[], len?: number): number[] {
        let arr = [].concat(inArr);
        let out = [];
        len = len || 1;
        if (len >= inArr.length) return inArr;

        for (let index = 0; index < len; index++) {
            let i = Math.floor(Math.random() * arr.length);
            let e = arr[i];
            arr.splice(i, 1);
            out.push(e);
        }

        return out;
    }
    /**
     * 从Arr1中移除Arr2的元素
     * @param arr1 
     * @param arr2 
     */
    public static removeArr2FroArr1(arr1: any[], arr2: any[]): any[] {
        let cArr = [].concat(arr1)
        for (let index = cArr.length - 1; index >= 0; index--) {
            const a1 = cArr[index];
            if (arr2.indexOf(a1) >= 0) {
                cArr.splice(index, 1);
            }
        }

        return cArr;
    }

    /**随机获取一个元素 */
    public static getRandomFromArr(arr: any[]) {
        if (arr.length <= 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }
    /**
     * 给一个数组随机排序
     */
    public static randomArr(arr: any[]): any[] {
        var len = arr.length;
        for (var i = 0; i < len - 1; i++) {
            var index = Math.floor(Math.random() * len);
            var temp = arr[index];
            arr[index] = arr[len - i - 1];
            arr[len - i - 1] = temp;
        }
        return arr;
    }
    //获取随机数
    public static getRandomIDStr(): string {
        let arr = 'asdadjaskdalkdqownaklsdjalasdad';
        let a = arr[Math.floor(Math.random() * arr.length)];
        a += Math.random() * 10000;
        return a;
    }
    //插值
    public static lerp(vec: Vec3, to: Vec3, ratioX: number, ratioY?: number, ratioZ?: number) {
        ratioY = ratioY ? ratioY : ratioX;
        ratioZ = ratioZ ? ratioZ : ratioX;
        vec.x += ratioX * (to.x - vec.x);
        vec.y += ratioY * (to.y - vec.y);
        vec.z += ratioZ * (to.z - vec.z);
        return vec;
    }
    //数字差值
    public static numberLerp(num: number, to: number, ratio: number) {
        return num + ratio * (to - num);
    }

    //转换到0~360
    public static getAngIn360(ang) { //0-360
        return (ang % 360 + 360) % 360;
    }
    // 转换到-180~180
    public static getAngIn180(ang) { //-180~180
        ang = ang % 360;
        if (ang > 180) {
            ang -= 360;
        }
        if (ang < -180) {
            ang += 360;
        }
        return ang;
    }

    private static _tmpSubV2 = v2();
    private static _tmpRotV2 = v2();
    /**
   * 角色正对面 扇形平面范围检测
   * @param pos 检测坐标
   * @param centerPos 角色自身位置
   * @param angleY 角色自身Y轴旋转 //默认初始朝向为 (1,0)
   * @param maxCosAng 范围最大角度*0.5 对应的 cos值
   * @param maxDist 最大距离
   * @returns 
   */
    public static atkAreaCheck(is3D: boolean, pos: Vec3, angleY: number, centerPos: Vec3, maxCosAng: number, maxDist: number): boolean {
        //--差值       
        if (is3D) {
            this._tmpSubV2.set(pos.x - centerPos.x, -(pos.z - centerPos.z));
        } else {
            this._tmpSubV2.set(pos.x - centerPos.x, pos.y - centerPos.y);
        }

        let len = this._tmpSubV2.length();
        //----1: 判断距离
        if (len > maxDist) return false;

        //---2: 判断是否同向
        this._tmpSubV2.normalize();
        this._tmpRotV2.set(1, 0);
        this._tmpRotV2.rotate(angleY * 0.01745);

        let dotN = this._tmpSubV2.dot(this._tmpRotV2);
        if (dotN < 0) return false;

        //----3: 判断角度
        return dotN > maxCosAng;
    }

    /**
     * 颜色转换
     * @param c 
     * @returns 
     */
    public static getColorRate(c: Color, out?: Vec4) {
        out = out || v4();
        out.x = c.r / 255;
        out.y = c.g / 255;
        out.z = c.b / 255;
        out.w = c.a / 255;
        return out;
    }

    /**
     * 根据目标旋转角度计算出旋转方式-弧度计算
     * @param d :curRadianY: 当前弧度, toDirec:旋转方向 , toRadianY: 目标弧度, r:弧度增量
     */
    public calRotation(d: { curRadianY: number, toDirec: number, toRadianY: number, r: number }) {
        d.toRadianY = d.r;
        //1.0 将当前角色角度+目标角度转换到360之内-弧度计算
        const pi = Math.PI;
        if (d.toRadianY < 0) {
            d.toRadianY += pi * 2;
        }
        d.curRadianY = d.curRadianY % (pi * 2);
        if (d.curRadianY > pi * 2) {
            d.toRadianY -= pi * 2;
        } else if (d.curRadianY < 0) {
            d.toRadianY += pi * 2;
        }
        //2.0 判断差值范围
        let sub = d.toRadianY - d.curRadianY;
        if (sub > pi) {
            //反向
            d.curRadianY += pi * 2;
            d.toDirec = -1;
        } else if (sub < -pi) {
            //反向
            d.toRadianY += pi * 2;
            d.toDirec = 1;
        } else if (sub > 0) {
            d.toDirec = 1;
        } else if (sub < 0) {
            d.toDirec = -1;
        }
    }

    private static tmpV2_1 = v2();
    private static tmpV2_2 = v2();
    /** 圆形检测-XZ平面*/
    public static circleCircleCheckXZ(p1: Vec3, r1: number, p2: Vec3, r2: number) {
        this.tmpV2_1.set(p1.x, -p1.z);
        this.tmpV2_2.set(p2.x, -p2.z);

        return Intersection2D.circleCircle(this.tmpV2_1, r1, this.tmpV2_2, r2);
    }
    /**清除对象所有属性的引用 */
    public static clearObj(obj) {
        if (!obj) return;
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (typeof obj[key] === "object") {
                    obj[key] = null;
                }
            }
        }
    }
}
