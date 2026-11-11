import { _decorator, Component, Node } from 'cc';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('ReplaceChildrenName')
@executeInEditMode
export class ReplaceChildrenName extends Component {
    @property
    fromArr: string[] = ['-', '1', '2', '3', '4', '5', '6', '7', '8'];
    @property
    toArr: string[] = ['_', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    @property
    useReplace = false;

    onEnable() {
        if (!this.useReplace) return;
        // let rgx = eval('/([-])+/g');
        // let str = 'Node-aa-1'.replace(/([-])+/g, '_'); //RegExp('/([-])+/g')  
        // console.log(rgx, ' ', str);

        this.node.children.forEach(e => {
            let name = e.name;
            for (let i = 0; i < this.fromArr.length; i++) {
                const f = this.fromArr[i];
                const t = this.toArr[i];
                let str = '/([' + f + '])/g';
                name = name.replace(eval(str), t);
                e.name = name;
                // console.log(str, ' ', name);
            }
            // console.log(name);

        })
    }
}

