import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initClosure } from '../src/closureService.js';

describe('closureService', () => {
    it('应返回空的 getChain（初始状态）', () => {
        const closure = initClosure();
        assert.deepEqual(closure.getChain('pop'), []);
        assert.deepEqual(closure.getChain('push'), []);
        assert.deepEqual(closure.getChain('peek'), []);
        assert.deepEqual(closure.getChain('switchStatus'), []);
        assert.deepEqual(closure.getChain('writeResultData'), []);
        assert.deepEqual(closure.getChain('writeExtra'), []);
    });

    it('未知函数名应返回空数组', () => {
        const closure = initClosure();
        assert.deepEqual(closure.getChain('unknown'), []);
    });

    it('push 后 getChain 应返回正确顺序的 chain', () => {
        const closure = initClosure();
        const fnA = (prev: (x: number) => number) => (x: number) => prev(x) + 1;
        const fnB = (prev: (x: number) => number) => (x: number) => prev(x) * 2;

        closure.push({ pop: fnA } as any);
        closure.push({ pop: fnB } as any);

        const chain = closure.getChain('pop');
        assert.equal(chain.length, 2);
        assert.equal(chain[0], fnA);
        assert.equal(chain[1], fnB);
    });

    it('不同函数名应互不干扰', () => {
        const closure = initClosure();
        closure.push({ pop: (prev: any) => prev, push: (prev: any) => prev });

        assert.equal(closure.getChain('pop').length, 1);
        assert.equal(closure.getChain('push').length, 1);
        assert.equal(closure.getChain('peek').length, 0);
    });

    it('应忽略 undefined 字段', () => {
        const closure = initClosure();
        closure.push({ pop: (prev: any) => prev });

        assert.equal(closure.getChain('push').length, 0);
    });

    it('多次 push 同一函数应累积', () => {
        const closure = initClosure();
        const fn = (prev: any) => prev;

        closure.push({ pop: fn });
        closure.push({ pop: fn });
        closure.push({ pop: fn });

        assert.equal(closure.getChain('pop').length, 3);
    });

    it('应支持所有 6 个函数名同时 push', () => {
        const closure = initClosure();
        const fn = (prev: any) => prev;
        closure.push({
            pop: fn,
            push: fn,
            peek: fn,
            switchStatus: fn,
            writeResultData: fn,
            writeExtra: fn,
        });

        assert.equal(closure.getChain('pop').length, 1);
        assert.equal(closure.getChain('push').length, 1);
        assert.equal(closure.getChain('peek').length, 1);
        assert.equal(closure.getChain('switchStatus').length, 1);
        assert.equal(closure.getChain('writeResultData').length, 1);
        assert.equal(closure.getChain('writeExtra').length, 1);
    });
});
