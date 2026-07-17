// funcTimer.ts — 受限函数调用计数器

import type { Timer } from './types.js';

export default function initTimer<T extends ((...args: any[]) => any)[]>(
    timer: Timer,
    funcs: [...T]
): { [K in keyof T]: (...args: Parameters<T[K]>) => ReturnType<T[K]> } {
    const counts: number[] = new Array(funcs.length);
    for (let i = 0; i < funcs.length; i++) {
        counts[i] = 0;
    }

    const restrictedFuncs = funcs.map(function (fn, i) {
        return function (this: any) {
            counts[i]++;
            return fn.apply(this, arguments as any);
        };
    });

    timer.checkTimes = function () {
        return counts.slice();
    };

    return restrictedFuncs as any;
}
