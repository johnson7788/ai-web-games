export namespace clog {

    /**
     * 日志（黑蓝白配色）
     * @param title 标题
     * @param msg 信息
     */
    export function log(title: any, msg?: any): void {
        if (msg) {
            console.log(
                `%c ${title} %c ${msg} `,
                'background: #35495E;padding: 1px;border-radius: 2px 0 0 2px;color: #fff;',
                'background: #409EFF;padding: 1px;border-radius: 0 2px 2px 0;color: #fff;'
            );
        } else {
            console.log(
                `%c ${title} `,
                'background: #409EFF;padding: 1px;border-radius: 0 2px 2px 0;color: #fff;',
            );
        }
    }

    export function mark(title: any, msg?: any): void {
        if (msg) {
            console.log(
                `%c ${title} %c ${msg} `,
                'background: #DD55FF;padding: 1px;border-radius: 2px 0 0 2px;color: #fff;',
                'background: #409EFF;padding: 1px;border-radius: 0 2px 2px 0;color: #fff;'
            );
        } else {
            console.log(
                `%c ${title} `,
                'background: #409EFF;padding: 1px;border-radius: 0 2px 2px 0;color: #fff;',
            );
        }
    }

    export function warn(title: any, msg?: any): void {
        if (msg) {
            console.log(
                `%c ${title} %c ${msg} `,
                'background: #FF7026;padding: 1px;border-radius: 2px 0 0 2px;color: #fff;',
                'background: #409EFF;padding: 1px;border-radius: 0 2px 2px 0;color: #fff;'
            );
        } else {
            console.log(
                `%c ${title} `,
                'background: #FF7026;padding: 1px;border-radius: 0 2px 2px 0;color: #fff;',
            );
        }
    }
    export function error(title: any, msg?: any): void {
        if (msg) {
            console.log(
                `%c ${title} %c ${msg} `,
                'background: #FF2626;padding: 1px;border-radius: 2px 0 0 2px;color: #fff;',
                'background: #FFA800;padding: 1px;border-radius: 0 2px 2px 0;color: #fff;'
            );
        } else {
            console.log(
                `%c ${title} `,
                'background: #FF2626;padding: 1px;border-radius: 0 2px 2px 0;color: #fff;',
            );
        }
    }
}

window["yy"] = clog;