import { _decorator, Component, Node } from 'cc';
import { BasicComponet } from '../../../../Init/Basic/BasicComponet';
const { ccclass, property } = _decorator;

@ccclass('MergeBasic')
export class MergeBasic extends BasicComponet {

    showEffect(d?): boolean {
        return true;
    }
}

