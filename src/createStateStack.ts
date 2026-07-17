// createStateStack.ts — 入口模块

import { initClosure } from './closureService.js';
import { createStateStackCore } from './createStateStackCore.js';
import type {
    StateStackDefinition,
    StateStackInstance,
    RefinementObject,
    CurriedCreateStateStack,
} from './types.js';

function ifRefinement(param: unknown): param is RefinementObject {
    return typeof param === 'object' && param !== null && (param as any).state === undefined;
}

function ifDefinition<S extends string>(param: unknown): param is StateStackDefinition<S> {
    return typeof param === 'object' && param !== null && (param as any).state !== undefined;
}

export function createStateStack<S extends string>(
    param: StateStackDefinition<S>,
    runParent?: () => void
): StateStackInstance;
export function createStateStack(
    param: RefinementObject,
    runParent?: () => void
): CurriedCreateStateStack;
export function createStateStack(
    param: StateStackDefinition<any> | RefinementObject,
    runParent?: () => void
): any {
    if (ifRefinement(param)) {
        const closure = initClosure();
        closure.push(param);

        return function createStateStackCurried(
            nextParam: StateStackDefinition<any> | RefinementObject,
            nextRunParent?: () => void
        ) {
            if (ifRefinement(nextParam)) {
                closure.push(nextParam);
                return createStateStackCurried;
            }
            if (ifDefinition(nextParam)) {
                return createStateStackCore(closure, nextParam, nextRunParent);
            }
            throw new Error(
                'createStateStack: 参数必须是 StateStackDefinitionObject（含 state 字段）或 StateStackRefinementObject（不含 state 字段）'
            );
        } as CurriedCreateStateStack;
    }
    if (ifDefinition(param)) {
        return createStateStackCore(initClosure(), param, runParent);
    }
    throw new Error(
        'createStateStack: 参数必须是 StateStackDefinitionObject（含 state 字段）或 StateStackRefinementObject（不含 state 字段）'
    );
}

export function refineCreateStateStack(
    refinementObject: RefinementObject
): RefinementObject {
    return refinementObject;
}
