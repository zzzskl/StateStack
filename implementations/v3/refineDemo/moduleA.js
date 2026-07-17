// moduleA.js — 覆写 pop，注入日志拦截
// 模拟横切关注点模块
// 注意：这里必须使用 createStateStack(refineCreateStateStack({...}))
//       而不是直接 refineCreateStateStack({...})

import { createStateStack as _createStateStack, refineCreateStateStack } from './stateStack.js';

export { refineCreateStateStack };

export const createStateStack = _createStateStack(refineCreateStateStack({
    // 模块级覆写：接收 prevPop（上一版本的 pop），返回加强版
    pop: (prevPop) => {
        return function moduleAPop() {
            console.log('[moduleA] pop intercepted — before');
            prevPop();
            console.log('[moduleA] pop intercepted — after');
        };
    },
}));
