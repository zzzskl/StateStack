# Module Chain (Refinement) — Function Overwriting System

> This document details StateStack's module chain mechanism. For complete runnable examples, see the [Usage Guide](./usage-guide.md#module-chainrefinementaop-style-function-overwriting).

---

## Why the Name "refine"?

`refineCreateStateStack` takes **`refine` to mean re-define**, not "purify" or "distill."

Its meaning is: **preserve the implementation of a function at the current layer, wrap new logic around it, and thus redefine its behavior** — like putting a new "skin" around a function.

```
Original pop function
  ┌──────────────────────┐
  │  do something       │
  │  originalPop()       │     ← after module chain wrapping
  │  do something       │
  └──────────────────────┘
           ↓
  ┌──────────────────────┐
  │  log: "pop before"  │     ← cross-cutting logic injected by Module A
  │  ┌────────────────┐ │
  │  │ originalPop()  │ │     ← original logic unchanged
  │  └────────────────┘ │
  │  log: "pop after"   │     ← cross-cutting logic injected by Module A
  └──────────────────────┘
```

> If you are familiar with Express/Koa middleware or Python decorators, the pattern is essentially the same — it's just applied at the function level rather than the request level.

---

## Mechanism

### Core: overwriteChain

The module chain is built on a simple `reduce`:

```js
// funcTransformer.js — core logic
export function transformer(originalFunc, overwriteChain) {
    if (!overwriteChain || overwriteChain.length === 0) {
        return originalFunc;
    }
    return overwriteChain.reduce((prevFunc, fn) => fn(prevFunc), originalFunc);
}
```

`overwriteChain` is an array where each element is a `(prevFunc) => newFunc` function. `reduce` composes them from left to right, layer by layer.

### Storage: closureService

`closureService.js` maintains overwrite chains for 6 functions, each independent:

```js
const chains = {
    pop: [],
    push: [],
    peek: [],
    switchStatus: [],
    writeResultData: [],
    writeExtra: [],
};
```

When `closure.push(refinementObject)` is called, each non-null field is appended to its corresponding chain.

### Trigger Condition

`createStateStack` has two modes, distinguished by whether the parameter contains a `state` field:

| Mode | Parameter Feature | Behavior |
|------|-------------------|----------|
| **Definition Mode** | Contains `state` field | Creates an instance directly |
| **Module Chain Mode** | Does NOT contain `state` field | Stores the parameter in closure, returns a new curried `createStateStack` |

```js
// Definition mode
createStateStack({ state: { ... }, ... })           → StateStackInstance

// Module chain mode
createStateStack({ pop: (prev) => ... })             → CurriedCreateStateStack
createStateStack({ pop: (prev) => ... })({ state: ... }) → StateStackInstance
```

---

## Usage

### Single Module

Overwrite a function in a single module:

```js
// moduleA.js
import { refineCreateStateStack, createStateStack as _core } from '@ffort_233/state-stack';

export const createStateStack = _core(refineCreateStateStack({
    pop: (prevPop) => () => {
        // Do extra work before/after the original pop
        console.log('[moduleA] pop before');
        prevPop();                           // call the original pop
        console.log('[moduleA] pop after');
    },
}));
```

The end user (main.js) imports `createStateStack` from `moduleA.js`, completely unaware of the module chain.

### Multiple Module Layering

Multiple modules can be chained, each overwriting only the functions it cares about:

```
moduleA overwrites pop
  → moduleB overwrites push (based on moduleA's exported createStateStack)
    → end user imports moduleB
```

The composition order follows the module chain addition order, left to right.

### Chained Syntax

Multiple overwrites can be applied in a single expression:

```js
import { refineCreateStateStack, createStateStack as core } from '@ffort_233/state-stack';

const createStateStack = core(refineCreateStateStack({ pop: logPop }))
                           (refineCreateStateStack({ push: logPush }))
                           (refineCreateStateStack({ peek: logPeek }));
```

This applies `logPop` first, then `logPush`, then `logPeek`.

### What is `refineCreateStateStack`?

It is just an **identity function** — input equals output. Its purpose is to serve as a **visual marker**:

- Lets readers immediately identify that this is "redefining" a function
- Provides TypeScript type inference support
- It works the same without it, but adding it makes the intent clearer

```js
// Works without refineCreateStateStack, but readability suffers
createStateStack({ pop: (prev) => () => { /* ... */ prev(); } });

// With refineCreateStateStack, intent is obvious at a glance
createStateStack(refineCreateStateStack({ pop: (prev) => () => { /* ... */ prev(); } }));
```

---

## Overwritable Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `pop` | `(prevPop) => () => unknown` | Pop operation, returns the popped value |
| `push` | `(prevPush) => (data) => void` | Push operation |
| `peek` | `(prevPeek) => () => unknown` | Read stack top |
| `switchStatus` | `(prevSwitchStatus) => (...args: unknown[]) => void` | State switch |
| `writeResultData` | `(prevWriteResultData) => (value) => void` | Write result data |
| `writeExtra` | `(prevWriteExtra) => (value) => void` | Write extra data |

---

## Use Cases

### Logging / Auditing

Record operation traces on every push/pop, completely transparent to business code.

### Caching

Overwrite `peek` or `push` to check a cache before/after stack operations:

```js
createStateStack(refineCreateStateStack({
    push: (prevPush) => (data) => {
        if (cache.has(data)) return;  // cache hit, skip push
        prevPush(data);
    },
}));
```

### Permission Checking

Validate whether the current user is authorized to enter the target state before `switchStatus`.

### Telemetry / Monitoring

Record timing on `pop`, report state change events on `switchStatus`.

---

## Relationship with the Definition Object

Functions overwritten in the module chain and functions with the same name in the definition object are **not at the same layer**. Their execution order is:

```
User-defined object functions (highest level)
    ↓ call simpleXxx
Module chain overwritten functions (middleware layer)
    ↓ transformer.reduce
Original stack functions (simplest level)
```

Using `pop` as an example:

```
Definition object's pop:
  (simplePop, writeResultData) => { write result; simplePop(); }

Module chain's pop:
  (prevPop) => () => { log; prevPop(); log; }

Execution order:
  definition pop → simplePop (i.e.: module chain composition → original stack pop)
```

---

## Further Reading

- [Usage Guide - Module Chain](./usage-guide.md#module-chainrefinementaop-style-function-overwriting) — Complete runnable examples
- [Core Concepts](./core-concepts.md) — peek, statusDispatcher, restricted functions
