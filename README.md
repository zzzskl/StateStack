# StateStack

**From the author**: StateStack fuses a stack with a state machine. It has several key design points.

1. **No classes** — the entire library is expressed using plain objects, yet still supports static augmentation across multiple module imports (at the cost of minor module side effects), with a declarative experience similar to classes.

2. **Nesting** — a StateStack can spawn child StateStacks, with explicit `run` primitives to transfer control flow between parent, child, and root creator.

3. **Constrained effects per cycle** — each "gather information → take action" round is limited. Effects are expressed through fixed-form stack operations (`pop`/`push`) and control-flow transfers (`run`). Write operations (`writeResultData`, `writeExtra`) and `switchStatus` calls are rate-limited per cycle.

4. **Stack top participates in dispatch** — the top-of-stack element feeds into `statusDispatcher`, enabling richer branching logic.

> **Note**: the project may still have rough edges and missing corner-case handling. Issues and feedback are welcome!
>
> **Supplement**: Currently, the run loop returns when it detects a `null` status, which does not align with the original design intent. Avoid relying on this behavior to exit; instead, use `run` with a concrete status to invoke the function passed by the root creator to explicitly transfer control flow.

[![npm version](https://img.shields.io/npm/v/state-stack)](https://www.npmjs.com/package/state-stack)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/types-included-blue)](./index.d.ts)

> 📖 [中文文档](./README.zh-CN.md)

---

## What is StateStack?

StateStack is not a typical state-machine library. It's designed for scenarios where:

> **Your workflow is a nested "drill down, bubble up" structure** — like recursive parsing, multi-stage pipelines, nested transactions. Each layer does its job, then returns the result to the layer above. StateStack codifies this "layer-by-layer push, layer-by-layer return" pattern into three primitive operations: **push**, **pop**, and **run** (control transfer).

**When to use it?**

- Your flow has a natural "enter sub-task → complete sub-task → return to parent" stack structure
- You want each layer's business logic to be independent, without hand-written state-transition tables
- You want to funnel side effects (push, pop, run child) into fixed operation forms, making cross-cutting concerns (logging, caching, auditing) easy

**When not to use it?**

- Simple 2–3 state flags — a `switch/case` is enough
- Complex concurrent states, orthogonal regions — tools like XState are more appropriate

---

## Installation

```bash
npm install state-stack
```

```js
import { createStateStack, refineCreateStateStack } from 'state-stack';
```

---

## Quick Start

A three-state (`idle → processing → done`) minimal state machine showing the full **push → process → pop → control return → loop termination** flow:

```js
import { createStateStack } from 'state-stack';

const ss = createStateStack({
    // ── state type declaration ──
    state: {
        status: ['idle', 'processing', 'done'],  // all possible status values
        resultData: { done: false },              // resultData field structure
    },

    // ── stack operation definitions ──
    peek: (peek) => peek(),                       // read top of stack
    push: (push, data) => push(data),             // push to stack
    pop: (pop, writeResultData) => {              // pop + write result
        writeResultData({ done: true });
        pop();
    },

    // ── status dispatcher: decides which handler runs ──
    statusDispatcher: (peek, status) => status,

    // ── state handlers ──
    idle: (state, peek, api) => {
        api.switchStatus('processing', { effect: 'push', param: ['task-001'] });
    },
    processing: (state, peek, api) => {
        api.switchStatus('done', { effect: 'pop' });
    },
    done: (state, peek, api) => {
        api.switchStatus(null, { effect: 'run' }); // control returns, loop ends
    },

    // ── init (runs immediately on createStateStack()) ──
    init: (state, push) => { state.status = 'idle'; },
});

ss.run();
console.log(ss.readState()); // { status: null, resultData: { done: true } }
```

**Execution flow:**
```
init → status = 'idle'
  → idle handler: switchStatus('processing', push) → push 'task-001' onto stack
  → processing handler: switchStatus('done', pop) → pop stack
  → done handler: switchStatus(null, run) → control returns, loop ends
```

---

## Documentation

| Doc | Content |
|-----|---------|
| **[Usage Guide](./docs/usage-guide.md)** | Full examples: peek, statusDispatcher, effect, restricted functions, child stacks, module chain, real-world scenarios |
| **[Core Concepts](./docs/core-concepts.md)** | The nature of peek, statusDispatcher responsibilities, restricted function design philosophy, effect semantics |
| **[Module Chain / Refinement](./docs/module-chain.md)** | AOP-style function overwriting: what "refine" means, single/multi/chain syntax, use cases |
| **[API Reference](./docs/api-reference.md)** | Complete interface signatures, type definitions, restrictions, error conditions |
| 📖 **中文文档** | [使用指南](./docs/usage-guide.zh-CN.md) · [核心概念](./docs/core-concepts.zh-CN.md) · [模块链](./docs/module-chain.zh-CN.md) · [API 参考](./docs/api-reference.zh-CN.md) |

---

## Source Structure

```
src/
├── Stack.ts                  # raw stack + state prototype (simplest layer)
├── funcTransformer.ts        # overwriteChain function composition (reduce)
├── closureService.ts         # module chain storage
├── funcTimer.ts              # restricted function call counter wrapper
├── createStateStack.ts       # entry: module chain / instance creation (dual mode)
└── createStateStackCore.ts   # core factory: 4-layer scope + run loop
```

---

## License

[Apache 2.0](./LICENSE)
