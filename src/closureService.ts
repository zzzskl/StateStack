// closureService.ts — 模块级闭包服务
// 负责存储 refinementObject 链，并提供按函数名查询 overwriteChain 的能力

import type { RefinementObject } from './types.js';

type ChainFunc = (...args: any[]) => any;
type Chains = Record<string, ChainFunc[]>;

interface Closure {
    push(refinementObject: RefinementObject): void;
    getChain(funcName: string): ChainFunc[];
}

export function initClosure(): Closure {
    const chains: Chains = {
        pop: [],
        push: [],
        peek: [],
        switchStatus: [],
        writeResultData: [],
        writeExtra: [],
    };

    const closure: Closure = {
        push(refinementObject: RefinementObject) {
            const funcNames = Object.keys(chains);
            for (let i = 0; i < funcNames.length; i++) {
                const name = funcNames[i];
                const fn = (refinementObject as any)[name];
                if (fn) {
                    chains[name].push(fn);
                }
            }
        },

        getChain(funcName: string) {
            return chains[funcName] || [];
        },
    };

    return closure;
}
