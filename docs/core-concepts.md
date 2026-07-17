# Core Concepts

> This document explains the four core concepts of StateStack in depth, helping you understand "why it was designed this way" rather than just "how to use it."
> For complete examples, see the [Usage Guide](./usage-guide.md).

---

## 1. `peek` — The Bridge Between Stack and State Machine

### What Problem Does It Solve?

In a typical state machine, the current state determines what to do. But in StateStack, **the content of the stack top** should also participate in decision-making — because the stack represents "the work unit currently being processed."

Consider a recursive parsing scenario: each level of delegation is a stack frame. When the state machine processes a level, it needs to read **the stack top of the current level** (i.e., the work unit currently being processed) to decide the next step. That's the responsibility of `peek`.

### Where Peek Appears

```
┌──────────────────────────────────────────────────────┐
│  definition object                                    │
│                                                       │
│  ┌─ statusDispatcher(peek, status) → statusName ────┐ │
│  │   ① Can sense the stack top when deciding state   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ statusHandler(state, peek, api) ───────────────┐ │
│  │   ② Can read stack top data when handling state  │ │
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─ peek: (simplePeek) => value ───────────────────┐ │
│  │   ③ Users can customize peek logic (caching,     │ │
│  │      transforming, etc.)                         │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Data Flow

```
run loop
  │
  ├─ statusDispatcher(peek, status)   ← calls peek() to get stack top
  │     ↓
  ├─ returns statusName
  │     ↓
  ├─ handler(state, peek, api)       ← handler calls peek() again
  │     ↓
  └─ api.switchStatus(nextStatus, effect)
```

### Key Understanding

- `peek` and `status` are two independent sources of information: the former comes from the stack, the latter from the state machine
- `statusDispatcher` receives both, enabling richer routing decisions than a pure state machine
- The `peek` in handlers is primarily used for reading the current work unit's data, not for changing state

---

## 2. `statusDispatcher` — Responsibility Boundary: Judge Only, Don't Execute

### What It Does

`statusDispatcher(peek, status)` has a single responsibility: **return the name of the state whose handler should execute**. It does not manipulate the stack, modify state, or produce side effects.

```
statusDispatcher inputs:
  - peek()   → stack top element (current work unit)
  - status   → current status name (string or null)

statusDispatcher outputs:
  - statusName (string)  → execute the corresponding handler
  - null                → terminate the state machine
```

### Typical Patterns

| Pattern | Implementation | Use Case |
|---------|----------------|----------|
| Simple passthrough | `(peek, status) => status` | Linear pipelines |
| Peek-driven | Inspect `peek()` value to decide next state | Route based on work unit type |

### What It Does NOT Do

- ❌ Does not call `push` / `pop`
- ❌ Does not modify `status`
- ❌ Does not produce side effects
- ❌ Does not execute business logic

This restriction is intentional: `statusDispatcher` only performs **routing decisions**; execution is left to handlers. This makes the routing logic testable and traceable.

---

## 3. Restricted Functions — "The Impact of One Cycle is Deterministic"

### Design Philosophy

`switchStatus`, `writeResultData`, and `writeExtra` may each be called **at most once per run loop cycle**. Exceeding this throws an error.

This is not a foolproofing mechanism — it is a core design principle:

> **How much logic a single status cycle can carry, and how much impact it can produce, should be deterministic.**

### Why?

Without this restriction, the following could happen:

```
// Problematic pattern (possible without restriction)
dangerous: (state, peek, api) => {
    api.switchStatus('a');
    api.writeResultData({ x: 1 });
    api.switchStatus('b');        // overwrites the previous switchStatus
    api.writeResultData({ y: 2 }); // overwrites the previous writeResultData
    api.switchStatus('c');
    // What is the net effect? Only the last one matters — the rest are garbage operations
}
```

With the restriction:

- Each handler can do **one deterministic thing** per cycle: switch to a state, write a result, or write extra data
- Callers can determine the observable impact upper bound of any handler
- When composing multiple handlers, there is no fear of "one step silently doing extra things"

### Mechanism

```
run loop starts → checkTimes() records snapshot
       ↓
handler executes → switchStatus / writeResultData / writeExtra each increment counter +1
       ↓
run loop ends → checkTimes() takes new snapshot, compares delta
       ↓
delta > 1 → throw error
delta = 0 or 1 → OK
```

### Unrestricted Operations

`createChildStateStack` and `childStateStack` are not restricted, because they do not change the current stack's state.

---

## 4. The Semantics of the Three Effect Operations

### Why Only Three?

StateStack's insight is that most "drill-down, layer-by-layer" workflows can be reduced to three primitives:

| Operation | Stack Change | Workflow Meaning |
|-----------|-------------|------------------|
| **push** | New element pushed onto stack top | Enter a sub-task; current state is suspended |
| **pop** | Stack top is popped | Sub-task complete; return to the previous layer |
| **run** | Stack unchanged | Control transfer; execute another stack |

These three operations cover all state transition patterns in scenarios like recursive parsing, multi-stage pipelines, and nested transactions.

### push — Go Deeper

```
Stack state:      Handler execution:
[item1]         api.switchStatus('next', { effect: 'push', param: [item2] })
[item1, item2]  ← item2 pushed; next handler sees item2
```

push means "current work isn't done yet, but let's push a new task in."

### pop — Return to Upper Layer

```
Stack state:      Handler execution:
[item1, item2]  api.switchStatus(null, { effect: 'pop' })
[item1]         ← item2 popped; back to item1
```

pop means "current work is done; return to the previous layer with results."

### run — Control Transfer

```
Current stack handler:
  api.switchStatus('done', { effect: 'run' })
    → Control returns to the runParent callback
    → Or executes a child stack ({ effect: 'run', param: ['child', id] })
```

run means "the current phase is done; hand control over to the outside."

### Combining Operations

These three operations can be combined: push then pop, push then run, pop then push again… covering all control flow patterns of nested workflows.

---

## Further Reading

- [Usage Guide](./usage-guide.md) — Complete examples and tutorials
- [Module Chain (Refinement)](./module-chain.md) — AOP-style function overwriting
- [API Reference](./api-reference.md) — Interface signatures and type definitions
