import Tools from "../../../../Init/Tools/Tools";

export class BasicState<T> {
    cmp: T = null;

    constructor(cmp: T) {
        this.cmp = cmp;
    }
    public reset() {
        Tools.clearObj(this);
    };
    public enter(d?) {

    }
    public onEvents() {

    }
    public offEvents() {

    }
    public update(dt) {

    }
    public exit() {

    }
}