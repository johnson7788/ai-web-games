import { _decorator, Component, Node, gfx, Mesh } from 'cc';
const { ccclass, property } = _decorator;

/**合并模型时的工具 */
@ccclass('MergeUtils')
export class MergeUtils {

    //获取给定的模型数据
    public static getRiginalMeshData(mesh: Mesh, isRot = false) {
        let data: any = {};
        data.positions = mesh.readAttribute(0, gfx.AttributeName.ATTR_POSITION);
        data.normals = mesh.readAttribute(0, gfx.AttributeName.ATTR_NORMAL);
        data.tangents = mesh.readAttribute(0, gfx.AttributeName.ATTR_TANGENT);
        data.uvs = mesh.readAttribute(0, gfx.AttributeName.ATTR_TEX_COORD);
        data.colors = mesh.readAttribute(0, gfx.AttributeName.ATTR_COLOR);
        data.indices = mesh.readIndices(0);

        //坐标系旋转
        if (isRot) {
            this.rotatePos(data.positions);
            this.rotatePos(data.normals);
            this.rotatePos(data.tangents);
        }
        return data;
    }
    //复制mesh数据 数组形式
    public static copyArr(a, b) {
        for (let i = 0, c = b.length; i < c; ++i) {
            a.push(b[i]);
        }
    }
    /**X轴旋转-90度 */
    public static rotatePos(arr: number[]) {
        let count = arr.length / 3;
        for (let i = 0; i < count; ++i) {
            let index = i * 3 + 1;
            let t = arr[index];
            arr[index] = arr[index + 1];
            arr[index + 1] = -t;
        }
    }
}

