import { _decorator, Component, Node, Material, MeshRenderer } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('ReplaceChildrenMat')
@executeInEditMode
export class ReplaceChildrenMat extends Component {
    @property(Material)
    mats: Material[] = [];

    @property
    useReplace = false;

    onEnable() {
        if (!this.useReplace) return;

        this.node.children.forEach(e => {
            let ms = e.getComponent(MeshRenderer);
            ms.sharedMaterials = this.mats;
        })

    }
}

