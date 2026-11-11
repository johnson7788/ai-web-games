import { _decorator, Component, Node, v3, Tween, tween, MeshRenderer, Mesh, quat, Vec3, Quat } from 'cc';
import { WeaponCfg } from '../../../Init/Config/GlobalConfig';
import { GlobalEnum } from '../../../Init/Config/GlobalEnum';
import GlobalPool from '../../../Init/Tools/GlobalPool';
import Loader from '../../../Init/Tools/Loader';
import { ModifyPosRotMesh } from './prop/ModifyPosRotMesh';
const { ccclass, property } = _decorator;

@ccclass('RoleHand')
export class RoleHand extends Component {

    @property(Node)
    hand: Node = null;

    _parent: Node = null;

    curWeapon: Node = null;
    curType: GlobalEnum.WeaponType = null;
    weaponMsr: ModifyPosRotMesh = null;
    followPos: Vec3 = null;
    followRot: Vec3 = null;
    roleScale = 1;

    init(parent: Node, followPos: Vec3, followRot: Vec3, roleScale: number) {
        this._parent = parent;
        this.followPos = followPos;
        this.followRot = followRot;
        this.roleScale = roleScale;
    }

    reset() {
        GlobalPool.put(this.curWeapon);
        Tween.stopAllByTarget(this._scaleAnim);
        this.curType = null;
        this.weaponMsr = null;
        this.curWeapon = null;
        this.followPos = null;
        this.followRot = null;
    }

    setWeapon(t: GlobalEnum.WeaponType) {
        if (this.curType == t) return;
        const _name = WeaponCfg[t].perfab;
        GlobalPool.put(this.curWeapon);
        this.curWeapon = GlobalPool.get(_name);
        this.curWeapon.setPosition(Vec3.ZERO);
        this.curWeapon.eulerAngles = Vec3.ZERO;
        this.curWeapon.parent = this._parent;
        this.weaponMsr = this.curWeapon.getComponent(ModifyPosRotMesh);
        this.curType = t;
        //动画
        this.showAnim();
        this.setWeaponData();

        //
        let node = this.hand.children[0];
        if (!node) {
            node = new Node();
            node.parent = this.hand;
        }
        const cfg = RoleHandCfg[WeaponCfg[this.curType].perfab];
        node.setPosition(cfg.p);
        node.eulerAngles = cfg.r;
        node.setScale(cfg.s, cfg.s, cfg.s);

    }
    // _缩放动画
    _scaleAnim = v3();
    showAnim() {
        Tween.stopAllByTarget(this._scaleAnim);
        this._scaleAnim.set(0, 0, 0);
        tween(this._scaleAnim).
            to(0.2, { x: 1 }, { easing: 'backOut' }).start();
    }

    updateAnim(dt) {
        this.setWeaponData();
    }
    tmpR = v3();
    tmpR2 = v3();
    tmpP = v3();
    tmpP2 = v3();
    tmpQ = quat();

    setWeaponData() {
        if (this.weaponMsr && this.followPos) {

            const cfg = RoleHandCfg[WeaponCfg[this.curType].perfab];
            //武器位置
            // this.tmpP.set(cfg.p).transformMat4(this.hand.worldMatrix).add(this.hand.worldPosition);
            // Vec3.rotateY(this.tmpP, this.tmpP, Vec3.ZERO, this.followRot.y);
            // //叠加位移
            // this.tmpP.add(this.followPos);

            //hand旋转 
            // //武器自身+跟随Hand旋转
            // this.tmpQ.set(this.hand.worldRotation);
            // this.tmpR2.set(cfg.r).multiplyScalar(0.01745);

            // Quat.rotateY(this.tmpQ, this.tmpQ, this.tmpR2.y);
            // Quat.rotateZ(this.tmpQ, this.tmpQ, this.tmpR2.z);
            // Quat.rotateX(this.tmpQ, this.tmpQ, this.tmpR2.x);

            // this.tmpQ.getEulerAngles(this.tmpR);
            // this.tmpR.multiplyScalar(0.01745);
            // //叠加角色旋转
            // this.tmpR.y += this.followRot.y;

            //--
            if (this.hand.children[0]) {
                this.tmpP.set(this.hand.children[0].worldPosition);
                Vec3.rotateY(this.tmpP, this.tmpP, Vec3.ZERO, this.followRot.y);
                this.tmpP.add(this.followPos);

                //
                this.tmpQ.set(this.hand.children[0].worldRotation);
                // Quat.rotateY(this.tmpQ, this.tmpQ, this.followRot.y);
                this.tmpQ.getEulerAngles(this.tmpR);
                this.tmpR.add(cfg.r);
                this.tmpR.multiplyScalar(0.01745);
                this.tmpR.y += this.followRot.y;
            }

            this.weaponMsr.setTransData(this.tmpP, this.tmpR, cfg.s * this.roleScale * this._scaleAnim.x);
        }
    }

}
/**武器配置 -世界坐标系下相对手的-偏移+旋转(弧度)*/
export const RoleHandCfg = {
    'Pistol': { p: v3(0.06, 0.214, -0.01), r: v3(-70.233, -97.281, 30.254), s: 1.5 },
    'Shotgun': { p: v3(0.06, 0.214, -0.01), r: v3(-70.233, -97.281, 30.254), s: 1.2 },
    'FireGun': { p: v3(0.003, 0.378, -0.131), r: v3(-70.233, -97.281, 30.254), s: 1.2 },
    'MachineGun': { p: v3(0.06, 0.214, -0.01), r: v3(-70.233, -97.281, 30.254), s: 1.2 },
    'Grenades': { p: v3(0.066, 0.132, 0.129), r: v3(-70.233, -97.281, 30.254), s: 1 },
}

