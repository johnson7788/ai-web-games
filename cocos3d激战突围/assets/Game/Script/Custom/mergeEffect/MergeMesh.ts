import { _decorator, Component, Node, Vec3, Mesh, v2, v3, Vec2, gfx } from 'cc';
import { MergeUtils } from './MergeUtils';
const { ccclass, property } = _decorator;
/**
 * <创建Mesh>
 * 将大量相同模型合并成同一个模型,
 * 并且将设定的速度 加速度 旋转等参数写入顶点数据中
 * 然后在shader中计算出物理轨迹
 */
@ccclass('MergeMesh')
export class MergeMesh {
    /**合并后的网格数据 根据类型记录 */
    public meshData: {
        positions: number[], normals: number[],
        minPos?: Vec3, maxPos?: Vec3, colors?: number[],
        uvs: number[], indices: number[], customAttributes?: any[]
    } = null;

    private subMesh: Mesh = null;
    private mergeCount = 1;
    //uv偏移设定
    private uvOffsetArr: Vec2[] = [];
    /**
     * 初始化
     * @param subMesh 合并的子网格
     * @param mergeCount 合并数量
     */
    public init(subMesh: Mesh, mergeCount: number, uvOffsetArr?: Vec2[]) {
        if (this.meshData) return;
        this.subMesh = subMesh;
        this.mergeCount = mergeCount;
        this.uvOffsetArr = uvOffsetArr || [v2(0, 0)];

        this.initMeshData();
        this.mergeMeshData();
    }

    //#region -------------模型数据-------
    /**初始化模型数据 */
    private initMeshData() {
        this.meshData = {
            positions: [],
            normals: [],
            uvs: [],
            indices: [],
            customAttributes: [
                {
                    //v4 xy:uv偏移, w:合并后的模型索引
                    attr: {
                        name: "a_animData0",
                        format: gfx.Format.RGBA32F,
                        isNormalized: false,
                        stream: 0,
                        isInstanced: false,
                        location: 0,
                    },
                    values: [],
                },
            ],
        };
    }

    /**合并模型数据 */
    private mergeMeshData() {
        let origData = MergeUtils.getRiginalMeshData(this.subMesh);
        let uvOffset = v2(0, 0);

        for (let i = 0; i < this.mergeCount; i++) {
            let vertCount = origData.positions.length / 3;
            let index = this.meshData.positions.length / 3;
            //复制基础数据
            MergeUtils.copyArr(this.meshData.positions, origData.positions);
            MergeUtils.copyArr(this.meshData.normals, origData.normals);
            MergeUtils.copyArr(this.meshData.uvs, origData.uvs);

            //索引
            for (let n = 0, c = origData.indices.length; n < c; ++n) {
                this.meshData.indices.push(origData.indices[n] + index);
            }
            //uv偏移
            if (this.uvOffsetArr.length > 0) {
                //随机获取偏移
                let v = this.uvOffsetArr[Math.floor(Math.random() * this.uvOffsetArr.length)] || uvOffset;
                uvOffset.set(v);
            }

            //自定义数据
            let values0 = this.meshData.customAttributes[0].values;
            for (let m = 0; m < vertCount; ++m) {
                values0.push(uvOffset.x, uvOffset.y, 0, i);
            }
        }
    }

    //#endregion

}
