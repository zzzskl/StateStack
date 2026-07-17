import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformer } from '../src/funcTransformer.js';

describe('funcTransformer', () => {
    it('应返回原函数（无 overwriteChain）', () => {
        const fn = (x) => x + 1;
        const result = transformer(fn, []);
        assert.equal(result(1), 2);
        assert.equal(result, fn);
    });

    it('应返回原函数（overwriteChain 为 null）', () => {
        const fn = (x) => x + 1;
        const result = transformer(fn, null);
        assert.equal(result(1), 2);
        assert.equal(result, fn);
    });

    it('应返回原函数（overwriteChain 为 undefined）', () => {
        const fn = (x) => x + 1;
        const result = transformer(fn);
        assert.equal(result(1), 2);
        assert.equal(result, fn);
    });

    it('单层 overwriteChain 应正确复合', () => {
        const fn = (x) => x + 1;
        const chain = [(prev) => (x) => prev(x) * 2];
        const result = transformer(fn, chain);
        // fn(2) = 3, *2 = 6
        assert.equal(result(2), 6);
    });

    it('多层 overwriteChain 应按顺序复合', () => {
        const fn = (x) => x + 1;
        const chain = [
            (prev) => (x) => prev(x) * 2,
            (prev) => (x) => prev(x) + 3,
        ];
        const result = transformer(fn, chain);
        // 第一层（chain[0]）：fn(3) = 4, *2 = 8
        // 第二层（chain[1]）prev 是上一结果：8 + 3 = 11
        assert.equal(result(3), 11);
    });

    it('多层 overwriteChain 执行顺序正确', () => {
        const calls = [];
        const fn = (x) => { calls.push('base'); return x; };
        const chain = [
            (prev) => (x) => { calls.push('a'); return prev(x); },
            (prev) => (x) => { calls.push('b'); return prev(x); },
        ];
        transformer(fn, chain)(42);
        assert.deepEqual(calls, ['b', 'a', 'base']);
    });
});
