// closureService — 模块级闭包服务
// 负责存储 refinitionObject 链，并提供按函数名查询 overwriteChain 的能力
//
// closure.push(refinementObject) — 存入一个 stateStackRefinementObject
// closure.getChain(funcName)   — 返回该函数的 overwriteChain（数组）

export function initClosure() {
    // 每种可覆写的函数对应一条 chain
    const chains = {
        pop: [],
        push: [],
        peek: [],
        switchStatus: [],
        writeResultData: [],
        writeExtra: [],
    };

    const closure = {};

    closure.push = function (refinementObject) {
        // refinementObject 是扁平结构：
        // { pop, push, peek, switchStatus, writeResultData, writeExtra }
        const funcNames = Object.keys(chains);
        for (let i = 0; i < funcNames.length; i++) {
            const name = funcNames[i];
            if (refinementObject[name]) {
                chains[name].push(refinementObject[name]);
            }
        }
    };

    closure.getChain = function (funcName) {
        return chains[funcName] || [];
    };

    return closure;
}
