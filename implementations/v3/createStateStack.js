// createStateStack — 入口模块
// 按模板结构：ifRefinement 创建闭包返回内层 createStateStack；
// ifDefinition 直接调用 createStateStackCore

import { initClosure } from './closureService.js';
import { createStateStackCore } from './createStateStackCore.js';

function ifRefinement(param) {
    return typeof param === 'object' && param !== null && param.state === undefined;
}

function ifDefinition(param) {
    return typeof param === 'object' && param !== null && param.state !== undefined;
}

/**
 * @param {StateStackDefinitionObject|StateStackRefinementObject} param
 * @param {Function} [runParent]
 */
export function createStateStack(param, runParent) {
    if (ifRefinement(param)) {
        const closure = initClosure();
        closure.push(param);

        return function createStateStack(nextParam, nextRunParent) {
            if (ifRefinement(nextParam)) {
                closure.push(nextParam);
                return createStateStack;
            }
            if (ifDefinition(nextParam)) {
                return createStateStackCore(closure, nextParam, nextRunParent);
            }
            throw new Error(
                'createStateStack: 参数必须是 StateStackDefinitionObject（含 state 字段）或 StateStackRefinementObject（不含 state 字段）'
            );
        };
    }
    if (ifDefinition(param)) {
        return createStateStackCore(initClosure(), param, runParent);
    }
    throw new Error(
        'createStateStack: 参数必须是 StateStackDefinitionObject（含 state 字段）或 StateStackRefinementObject（不含 state 字段）'
    );
}

// refineCreateStateStack — 模块层的纯视觉标识，直接返回参数
export function refineCreateStateStack(refinementObject) {
    return refinementObject;
}
