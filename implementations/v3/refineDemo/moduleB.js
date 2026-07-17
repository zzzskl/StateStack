// moduleB.js — 覆写 push，注入日志拦截
// 从 moduleA 导入增强后的 createStateStack，追加 push 覆写

import { createStateStack as _createStateStack, refineCreateStateStack } from './moduleA.js';

export const createStateStack = _createStateStack(refineCreateStateStack({
    // 模块级覆写：接收 prevPush，返回加强版
    push: (prevPush) => {
        return function moduleBPush(data) {
            console.log('[moduleB] push intercepted, data:', data);
            prevPush(data);
        };
    },
}));
