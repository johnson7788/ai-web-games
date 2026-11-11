import { _decorator, Component, Node, Vec3, v3 } from 'cc';
const { ccclass, property } = _decorator;
const tmpP0 = v3();
const tmpP1 = v3();
const tmpP2 = v3();
const tmpP3 = v3();
const tmpP4 = v3();
const tmpP5 = v3();
const tmpP6 = v3();
const tmpP7 = v3();
const tmpP8 = v3();

@ccclass('CustomCollision')
export class CustomCollision {


    /**两个矩形的中心点 ,宽,高,Y轴旋转角度*/
    RectRectXZ(cnt1: Vec3, w1: number, h1: number, roty1: number, cnt2: Vec3, w2: number, h2: number, roty2: number,) {
        //矩形1
        const cw1 = w1 * 0.5;
        const ch1 = h1 * 0.5;
        tmpP1.set(cnt1.x - cw1, cnt1.y, cnt1.z - ch1); //左上
        tmpP2.set(cnt1.x + cw1, cnt1.y, cnt1.z - ch1); //右上
        tmpP3.set(cnt1.x + cw1, cnt1.y, cnt1.z + ch1); //右下
        tmpP4.set(cnt1.x - cw1, cnt1.y, cnt1.z + ch1); //左下
        //旋转1
        const _cos1 = Math.cos(roty1 * 0.01745);
        const _sin1 = Math.sin(roty1 * 0.01745);
        tmpP0.set(tmpP1);
        tmpP1.x = tmpP0.z * _sin1 + tmpP0.x * _cos1;
        tmpP1.z = tmpP0.z * _cos1 - tmpP0.x * _sin1;
        tmpP0.set(tmpP2);
        tmpP2.x = tmpP0.z * _sin1 + tmpP0.x * _cos1;
        tmpP2.z = tmpP0.z * _cos1 - tmpP0.x * _sin1;
        tmpP0.set(tmpP3);
        tmpP3.x = tmpP0.z * _sin1 + tmpP0.x * _cos1;
        tmpP3.z = tmpP0.z * _cos1 - tmpP0.x * _sin1;
        tmpP0.set(tmpP4);
        tmpP4.x = tmpP0.z * _sin1 + tmpP0.x * _cos1;
        tmpP4.z = tmpP0.z * _cos1 - tmpP0.x * _sin1;
        
 


        //矩形2
        const cw2 = w2 * 0.5;
        const ch2 = h2 * 0.5;
        tmpP5.set(cnt2.x - cw2, cnt2.y, cnt2.z - ch2); //左上
        tmpP6.set(cnt2.x + cw2, cnt2.y, cnt2.z - ch2); //右上
        tmpP7.set(cnt2.x + cw2, cnt2.y, cnt2.z + ch2); //右下
        tmpP8.set(cnt2.x - cw2, cnt2.y, cnt2.z + ch2); //左下
        //旋转2
        const _cos2 = Math.cos(roty2 * 0.01745);
        const _sin2 = Math.sin(roty2 * 0.01745);
        tmpP0.set(tmpP5);
        tmpP5.x = tmpP0.z * _sin2 + tmpP0.x * _cos2;
        tmpP5.z = tmpP0.z * _cos2 - tmpP0.x * _sin2;
        tmpP0.set(tmpP6);
        tmpP6.x = tmpP0.z * _sin2 + tmpP0.x * _cos2;
        tmpP6.z = tmpP0.z * _cos2 - tmpP0.x * _sin2;
        tmpP0.set(tmpP7);
        tmpP7.x = tmpP0.z * _sin2 + tmpP0.x * _cos2;
        tmpP7.z = tmpP0.z * _cos2 - tmpP0.x * _sin2;
        tmpP0.set(tmpP8);
        tmpP8.x = tmpP0.z * _sin2 + tmpP0.x * _cos2;
        tmpP8.z = tmpP0.z * _cos2 - tmpP0.x * _sin2;



    }

}

