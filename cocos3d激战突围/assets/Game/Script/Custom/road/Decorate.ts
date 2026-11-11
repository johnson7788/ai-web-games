import { _decorator, Component, Node, Mesh, MeshRenderer } from 'cc';
import { BasicComponet } from '../../../../Init/Basic/BasicComponet';
import GlobalPool from '../../../../Init/Tools/GlobalPool';
const { ccclass, property } = _decorator;

@ccclass('Decorate')
export class Decorate extends BasicComponet {

    building: Node = null;
    arr = ['Architecture_A', 'Architecture_B', 'Architecture_C', 'Architecture_D', 'Architecture_E'];

    onEnable() {
        //随机建筑
        if (!this.building) {
            let name = this.arr[Math.floor(Math.random() * this.arr.length)];
            this.building = GlobalPool.get(name);
            this.building.parent = this.node;
            this.building.setPosition(0, 0, 0);
            let ms = this.building.getComponent(MeshRenderer);
            if (ms) {
                // delete ms.mesh.struct.maxPosition;
                // delete ms.mesh.struct.minPosition;
                ms.mesh.struct.maxPosition.multiplyScalar(3);
                ms.mesh.struct.minPosition.multiplyScalar(3);
            }
        }
    }

}

