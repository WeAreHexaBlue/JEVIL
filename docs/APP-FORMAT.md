# JEVIL App Format — `jevil/app@1`

> **Status:** normative draft · v1.0 · 2026-11-01
> **Owner:** runtime + editor. Changes to this file require a schema version decision.
> **Companion docs:** [SPEC.md](../SPEC.md) · [ROADMAP.md](../ROADMAP.md) · [DESIGN.md](./DESIGN.md)

A JEVIL app is a **declarative JSON blueprint**. It is not code. The trusted runtime interprets it, calls decision models, resolves bindings, and renders allowlisted Svelte components. This is what makes apps safe to run, cheap to fork, and diffable.

```json
{
  "schema": "jevil/app@1",
  "meta": { "...": "..." },
  "inputs": [],
  "steps": [],
  "vars": {},
  "ui": { "type": "Stack", "id": "root", "props": {}, "children": [] }
}
```

---

## 1. Top-level shape

```ts
interface Blueprint {
  schema: "jevil/app@1";
  meta: AppMeta;
  preview?: Preview;
  inputs: InputDef[];
  steps: DecideStep[];
  vars: Record<string, VarDef>;
  ui: Node;
  actions?: Record<string, ActionDef>;
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `schema` | yes | Exact string `jevil/app@1`. |
| `meta` | yes | Marketplace metadata + engine requirements. |
| `preview` | no | Sample inputs + answers for instant catalog previews. Never billed. |
| `inputs` | yes | 0–8 inputs. Most apps need at least one. |
| `steps` | yes | 0–10 decide steps, executed in order. |
| `vars` | yes | Derived values; may be empty. |
| `ui` | yes | A single root node; max 200 nodes. |
| `actions` | no | Reusable action definitions referenced by buttons. |

---

## 2. `meta`

```ts
interface AppMeta {
  title: string;            // 2–48 chars
  tagline: string;          // 8–120 chars, one sentence
  description?: string;     // 0–2,000 chars, plain text paragraphs
  tags: string[];           // 1–5, lowercase kebab-case, max 24 chars each
  accent: "blue" | "pink" | "lime" | "tangerine" | "violet" | "sky";
  icon: string;             // 1–8 chars (emoji) or an allowlisted icon name
  engine: {
    media: Array<"text" | "image" | "audio" | "video">; // v1: ["text"]
    recommended?: Array<"jev" | "laya" | "clef" | "cloudflare" | "systemone">;
  };
  autorun?: boolean;        // default false; run on load and on debounced input changes
}
```

- `title`, `tagline`, `tags`, `accent`, and `icon` are also stored as columns for catalog queries.
- `description` is rendered as paragraphs, never HTML. Line breaks are preserved.
- `engine.media` is a capability requirement. A text-only connection cannot run an app that requires `image`.
- `recommended` is a hint for the connection picker, not a hard requirement. Any System One-compatible connection is allowed.

---

## 3. `preview`

Previews let the catalog and detail page render a real result **without a model call**. They are optional; without one, the runtime renders an `EmptyState` until the user runs the app.

```ts
interface Preview {
  inputs: Record<string, string | number | boolean>;
  answers?: Record<string, Record<string, Answer>>; // stepId → questionId → Answer
}
```

- `preview.inputs` must satisfy the input schema.
- `preview.answers` uses the same `Answer` shape as the runtime (see §6).
- The UI shows a small **sample** badge whenever preview answers are displayed.
- The editor's "Capture preview" button fills this from the last successful test run.

---

## 4. `inputs`

```ts
interface InputDef {
  id: string;                 // [a-z][a-z0-9_]{0,31}, unique
  type: "text" | "textarea" | "select" | "slider" | "toggle" | "color";
  label: string;              // 1–80 chars
  help?: string;              // 0–160 chars
  placeholder?: string;
  default?: string | number | boolean;
  required?: boolean;         // default true
  maxLength?: number;         // text 1–500; textarea 1–4000
  options?: Array<{ value: string; label: string }>; // select only, 1–24
  min?: number;               // slider only
  max?: number;               // slider only
  step?: number;              // slider only, default 1
}
```

Rules:

- `id` is the variable name authors bind to: `{{inputs.word}}`.
- `select` requires `options`; `slider` requires `min` and `max` with `min < max`.
- `color` defaults to a `#rrggbb` string.
- Inputs are always rendered in the app's control panel, in declaration order, unless the UI references them explicitly. (v1 renders them in a generated control panel above the app body.)
- Inputs are trimmed; empty required inputs block the run with a field-level error.

---

## 5. `steps` and questions

```ts
interface DecideStep {
  id: string;                 // [a-z][a-z0-9_]{0,31}, unique
  kind: "decide";
  label?: string;             // editor-only, max 60 chars
  state: Binding;             // must resolve to string | object | array
  questions: Record<string, Question>;
  model?: string;             // optional provider model override
  when?: Binding;             // boolean; skip the step when false
}
```

```ts
type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string };
```

Rules:

- 1–20 questions per step; 40 total across all steps.
- `choice` criteria: 2–24 options; keys match `[a-z][a-z0-9_-]{0,31}`; descriptions 1–160 chars.
- `score` criteria: 2–10 ordered levels, each 1–60 chars.
- `noul` has no criteria.
- `instructions` is 1–240 chars. Write it as a question the model can answer from the state.
- `state` is the only place app data reaches the model. Keep it short; input tokens are billed.
- `when` is evaluated before the call. A skipped step has no answers; dependent vars use fallbacks.
- Steps run sequentially. A step can reference answers from earlier steps in its `state` template.
- No `box` questions in v1. No image/audio/video arrays in v1 (schema reserves `engine.media` for later).

---

## 6. Answers and scope

```ts
type Pick =
  | "value"        // default: choice key, normalized score, or noul probability
  | "choice"
  | "score"
  | "noul"
  | "confidence"
  | "probabilities"
  | "answer";

type Answer =
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | {
      type: "score";
      score: number;                 // normalized 0..1
      confidence: number;
      probabilities: Record<string, number>;
      level?: number;                // raw provider index
      levels?: number;               // number of criteria levels
    }
  | { type: "noul"; noul: number };
```

After a step runs, its answers are available under:

```
steps.<stepId>.<questionId>            → the question's primary value
steps.<stepId>.<questionId>.choice     → choice key
steps.<stepId>.<questionId>.score      → normalized 0..1 score
steps.<stepId>.<questionId>.noul       → 0..1 probability
steps.<stepId>.<questionId>.confidence → 0..1 (choice/score)
steps.<stepId>.<questionId>.probabilities → record
```

Primary values by type:

| Question | Primary value | Type |
| --- | --- | --- |
| `choice` | winning key | `string` |
| `score` | normalized score | `number` (0..1) |
| `noul` | probability | `number` (0..1) |

Bindings can request a specific field with `pick`:

```json
{ "step": "read", "question": "family", "pick": "probabilities" }
```

`pick` ∈ `"value"` (default), `"choice"`, `"score"`, `"noul"`, `"confidence"`, `"probabilities"`, `"answer"`.

Scope roots:

| Root | Example | Notes |
| --- | --- | --- |
| `inputs` | `{{inputs.word}}` | Current input values. |
| `steps` | `{{steps.read.family}}` | Answers from completed steps. |
| `vars` | `{{vars.hue}}` | Derived values. |
| `meta` | `{{meta.title}}` | Read-only app metadata. |

---

## 7. Bindings and templates

A **binding** is a safe reference. It is never evaluated as JavaScript.

```ts
type Binding =
  | { lit: string | number | boolean | null | unknown[] | Record<string, unknown> }
  | { var: string }   // a declared var id, or inputs.<id>, vars.<id>, meta.<field>
  | { step: string; question: string; pick?: Pick }   // answers
  | { template: string };                             // {{path}} interpolation
```

In component props, plain primitives are also accepted and treated as literals:

```json
{ "type": "Heading", "id": "h", "props": { "level": 2, "text": "Hello" } }
```

### 7.1 Templates

Templates interpolate dot paths inside `{{ }}`:

```
"{{inputs.word}} reads as {{steps.read.family.choice}}."
```

- Allowed paths: `inputs.<id>`, `vars.<id>`, `steps.<stepId>.<questionId>[.<field>]`, `meta.<field>`.
- No function calls, arithmetic, conditionals, or indexing inside `{{ }}`.
- Escape a literal opening with `\{{`. The rest of the text, including any `}}`, renders literally.
- Missing values render as an empty string; validation flags unknown paths before publish.
- Templates always produce a string.

### 7.2 Transforms (for `vars`)

A derived variable is either a **source + transform chain** or a **builtin call**:

`vars` keys are lowerCamelCase: `[a-z][a-zA-Z0-9_]{0,31}`.

```ts
interface VarDef {
  type: "string" | "number" | "boolean" | "color" | "color[]"
      | "string[]" | "number[]" | "json";
  from?: Binding;                 // exactly one of from / fn
  transform?: Transform[];
  fn?: BuiltinName;               // exactly one of from / fn
  args?: Record<string, Binding | string | number | boolean>;
  fallback?: unknown;
}
```

```ts
type Transform =
  | { op: "lerp"; in: [number, number]; out: [number, number]; clamp?: boolean }
  | { op: "clamp"; min: number; max: number }
  | { op: "round"; to?: number }                       // decimals, default 0
  | { op: "lookup"; map: Record<string, unknown>; default?: unknown }
  | { op: "mapRange"; in: [number, number]; out: [number, number]; clamp?: boolean }
  | { op: "default"; value: unknown }
  | { op: "concat"; prefix?: string; suffix?: string; separator?: string; values?: Binding[] }
  | { op: "percent"; decimals?: number }               // 0.71 → "71%"
  | { op: "abs" }
  | { op: "min"; value: number }
  | { op: "max"; value: number };
```

Semantics:

- Transforms run left to right.
- `lerp`/`mapRange` map a number from `in` to `out`; `clamp` defaults to `true`.
- `lookup` uses the source as a key; missing keys use `default` (or the variable's `fallback`).
- `default` replaces `null`, `undefined`, `""`, and `NaN`.
- A type mismatch fails validation; at runtime it falls back to `fallback` or a type-appropriate zero value and logs a warning.

### 7.3 Builtins

Builtins are pure, deterministic, and allowlisted.

| Builtin | Signature | Returns | Notes |
| --- | --- | --- | --- |
| `hsl` | `{ h, s, l }` | `color` | `h` 0–360, `s`/`l` 0–100 → `#rrggbb` |
| `mix` | `{ a, b, t }` | `color` | Linear RGB mix, `t` 0–1 |
| `shade` | `{ color, amount }` | `color` | `amount` −1..1; negative darkens |
| `contrastText` | `{ color }` | `color` | `#16150F` or `#FFFFFF`, whichever has more contrast |
| `palette` | `{ hue, saturation, lightness, harmony, count?, seed? }` | `color[]` | See §7.4 |
| `formatNumber` | `{ value, decimals? }` | `string` | Locale-independent, `en-US` grouping |
| `pick` | `{ list, seed }` | `json` | Deterministic choice from a list |
| `first` | `{ list }` | `json` | First element or `null` |

`seed` is a string or number. When omitted, the runtime uses a hash of the current inputs, so identical runs look identical.

### 7.4 `palette` reference algorithm

```ts
const HARMONY = {
  analogous:     [0, -24, 24, -12, 12],
  complementary: [0, 180, 12, 192, -12],
  triadic:       [0, 120, 240, 12, 132],
  split:         [0, 150, 210, -30, 30],
  monochrome:    [0, 0, 0, 0, 0],
  tetradic:      [0, 90, 180, 270, 45]
};
const SPREAD = { monochrome: 9, analogous: 4, complementary: 5, triadic: 6, split: 6, tetradic: 5 };

for (i = 0; i < count; i++) {
  const h = (hue + HARMONY[harmony][i % 5] + jitter(seed, i, 6) + 360) % 360;
  const s = clamp(saturation + jitter(seed, i + 11, 8), 8, 92);
  const l = clamp(lightness + (i - (count - 1) / 2) * SPREAD[harmony] + jitter(seed, i + 23, 4), 8, 94);
  colors.push(hslToHex(h, s, l));
}
```

`jitter` is a deterministic PRNG in `[-amount, amount]` seeded by `hash(seed + ":" + i)`. Implementations must be stable across runs and platforms; snapshot tests lock the output.

---

## 8. UI nodes

```ts
interface Node {
  type: ComponentName;        // allowlist, see §8.1
  id: string;                 // [a-z][a-z0-9_-]{0,63}, unique in the tree
  props?: Record<string, PropValue>;
  children?: Node[];
  visible?: Binding;          // boolean; default true
}
```

- `id` is required. The editor uses it for selection, undo, and error pointers.
- `props` values are literals, bindings, or primitives.
- `children` is only allowed on container components.
- `visible: false` removes the node and its subtree from layout.
- `visible` coercion: booleans pass through; numbers are true when `> 0.5` (so a `noul` probability works directly); strings are true when non-empty; `null`/missing is true.
- Unknown component types or props are validation errors; the runtime renders nothing for that node and logs a warning.
- Text is always rendered as text. There is no `{@html}`, no markdown HTML, no inline CSS, no event handlers other than `action`.

### 8.1 Component catalog (v1)

#### Layout

| Component | Props | Children |
| --- | --- | --- |
| `Stack` | `direction: "column" \| "row"` (default `column`), `gap: 0–12` (default 4), `align: "start" \| "center" \| "end" \| "stretch"`, `justify: "start" \| "center" \| "end" \| "between"`, `padding: 0–8`, `wrap: boolean` | yes |
| `Grid` | `columns: 1–6` (default 2), `gap: 0–8`, `align: "start" \| "stretch"` | yes |
| `Card` | `tone: "paper" \| "tint" \| "ink"` (default `paper`), `padding: 0–8`, `radius: "sm" \| "md" \| "lg"` | yes |
| `Spacer` | `size: 0–16` | no |
| `Divider` | `label?: string` | no |

#### Inputs

Inputs are normally rendered in the generated control panel. These components let an author place a specific input inside the app body (the control panel then hides the duplicate).

| Component | Props |
| --- | --- |
| `TextInput` | `input: string` (input id), `label?`, `placeholder?`, `maxLength?` |
| `TextArea` | `input: string`, `label?`, `rows: 2–10`, `maxLength?` |
| `Select` | `input: string`, `label?` |
| `Slider` | `input: string`, `label?`, `showValue?: boolean` |
| `Toggle` | `input: string`, `label?` |
| `ColorInput` | `input: string`, `label?` |

#### Display

| Component | Props |
| --- | --- |
| `Heading` | `text`, `level: 1–4` (default 2), `align: "start" \| "center"` |
| `Text` | `text`, `size: "sm" \| "md" \| "lg"` (default `md`), `tone: "default" \| "muted" \| "accent"`, `align` |
| `Badge` | `text`, `tone: "neutral" \| "blue" \| "pink" \| "lime" \| "tangerine" \| "violet"` |
| `Stat` | `label`, `value`, `hint?` |
| `Meter` | `value: 0–1`, `label?`, `tone?` |
| `ScoreDial` | `label`, `value: 0–1`, `levels?: string[]` |
| `ProbabilityBars` | `label?`, `probabilities: Record<string, number>`, `highlight?: string` |
| `Palette` | `colors: string[]`, `labels?: boolean`, `size?: "sm" \| "md" \| "lg"` |
| `Canvas` | `height: 120–480`, `paint: "palette-field" \| "stripes" \| "grain" \| "orb"`, `colors?: string[]`, `energy?: 0–1`, `seed?: string`, `background?: color` |
| `Shape` | `kind: "blob" \| "ring" \| "star" \| "squiggle"`, `color?`, `size: 24–240`, `rotate?: -180–180` |
| `List` | `items: string[]`, `ordered?: boolean`, `marker?: "dot" \| "number" \| "none"` |
| `Icon` | `name` (allowlist), `size: 16–48`, `color?` |
| `ConfidenceChip` | `value: 0–1`, `label?: string` |
| `Skeleton` | `height: 8–240`, `width?: "full" \| "half"` |
| `ErrorNote` | `title?`, `message` |
| `EmptyState` | `title`, `message`, `icon?` |

#### Actions

| Component | Props |
| --- | --- |
| `Button` | `label`, `variant: "primary" \| "secondary" \| "ghost" \| "danger"` (default `primary`), `action: ActionDef \| { ref: string }`, `disabled?: boolean`, `fullWidth?: boolean` |
| `IconButton` | `icon`, `label` (aria-label), `action`, `variant?` |

`Icon` names: `spark`, `palette`, `arrow-right`, `check`, `x`, `plus`, `minus`, `play`, `reset`, `copy`, `link`, `info`, `warning`, `shuffle`. Icons are inline SVGs from the design system; no icon fonts, no remote SVGs.

### 8.2 Prop types

| Type | JSON | Notes |
| --- | --- | --- |
| `string` | `"hello"` | Rendered as text. |
| `number` | `0.5` | Range-checked per prop. |
| `boolean` | `true` | |
| `color` | `"#ff5d8f"` | `#rgb`, `#rrggbb`, or `hsl()` resolved at build time. |
| `color[]` | `["#...", "#..."]` | 2–12 colors. |
| `record` | `{ "key": 0.4 }` | Used by `ProbabilityBars`. |
| `binding` | `{ "var": "hue" }` | Resolved at render time. |

---

## 9. Actions

```ts
type ActionDef =
  | { kind: "run" }
  | { kind: "reset" }
  | { kind: "set"; var: string; value: Binding }   // only inputs are writable in v1
  | { kind: "copy"; value: Binding; label?: string }
  | { kind: "open"; url: Binding }                 // https only
  | { kind: "none" };
```

- `run` executes the pipeline. While running, buttons show a pending state and are disabled.
- `reset` clears answers, restores input defaults, and returns to the preview/empty state.
- `set` writes an input value. It does not auto-run unless `meta.autorun` is true.
- `copy` writes the resolved string to the clipboard and shows a toast.
- `open` opens a URL in a new tab. Only `https://` is allowed; validation rejects `javascript:`, `data:`, and relative URLs.
- Actions are declarative. There are no scripts in v1.

Reusable actions:

```json
"actions": {
  "again": { "kind": "run" }
}
```

```json
{ "type": "Button", "id": "again", "props": { "label": "Again", "action": { "ref": "again" } } }
```

---

## 10. Runtime semantics

### 10.1 Lifecycle

1. **Validate** the blueprint against the schema + semantic rules.
2. **Initialize** inputs from defaults and URL query params (`?word=...`).
3. If `preview` exists, render with `preview.answers` and a **sample** badge.
4. If `meta.autorun` is true and a connection is available, run on first paint.
5. On `run`:
   - Set status `running`.
   - Execute each step in order; evaluate `when` first.
   - Build `state` from its binding; enforce the 8,000-character cap after interpolation.
   - Call the transport with the selected connection.
   - Normalize answers and store them under `steps.<id>`.
   - On error, stop, keep previous answers, set the step's error, and show `ErrorNote`.
   - After all steps, evaluate `vars` in dependency order.
   - Set status `success`; announce the result with `aria-live="polite"`.
6. Input changes mark results **stale**. With `autorun`, debounce 500 ms and re-run; otherwise show a subtle "Inputs changed — run again" hint.

### 10.2 Variable evaluation

- Build a dependency graph from `from`, `transform.values`, and `args`.
- Topologically sort; cycles are validation errors.
- A var with a missing dependency uses `fallback` (or a zero value) and does not block rendering.
- `vars` may reference other `vars` declared later; declaration order is irrelevant.

### 10.3 Determinism

- `pick` and `palette` use a PRNG seeded by `hash(seed ?? JSON.stringify(inputs))`.
- The same inputs + answers must produce the same colors, shapes, and layout.
- Do not use `Math.random()` in the runtime.
- Canvas rendering caps device pixel ratio at 2 for predictable snapshots.

### 10.4 Limits

| Limit | Value |
| --- | --- |
| Inputs | 8 |
| Steps | 10 |
| Questions per step | 20 |
| Questions total | 40 |
| State length | 8,000 chars after interpolation |
| UI nodes | 200 |
| UI depth | 12 |
| Template length | 2,000 chars |
| Choice options | 24 |
| Score levels | 2–10 |
| Palette colors | 2–12 |
| Canvas height | 120–480 px |
| Run timeout | 15 s per step |

### 10.5 Failure behavior

- A validation error blocks publish and shows a JSON pointer (e.g. `/ui/children/2/props/colors`).
- A runtime binding error renders the component's fallback, not a blank screen.
- A provider error shows `ErrorNote` with a safe message and a retry action. Never show raw provider JSON.
- A cancelled run aborts the in-flight request and keeps the last successful result visible with a "cancelled" note.

---

## 11. Validation rules

Publish is blocked unless all of these pass:

- [ ] `schema` is exactly `jevil/app@1`.
- [ ] `meta.title` 2–48 chars; `tagline` 8–120; 1–5 tags; valid accent/icon.
- [ ] `engine.media` is a subset of the target connection capabilities (checked at run time too).
- [ ] Every input id is unique and valid; defaults match types; select options non-empty.
- [ ] Every step id is unique; question ids unique within a step; criteria counts in range.
- [ ] Every `state` binding resolves to a string/object/array; every `when` resolves to boolean.
- [ ] Every `vars` key is unique and valid; exactly one of `from`/`fn`; no cycles.
- [ ] Every transform op is known; numeric ranges are valid; `lookup` maps are non-empty.
- [ ] Every UI node has a unique id; component type is allowlisted; props match types and ranges.
- [ ] Every binding path resolves to a known input, step, question, or var.
- [ ] `children` only appears on containers; no node exceeds depth 12; total nodes ≤200.
- [ ] Every action ref exists; `open` URLs are `https://`.
- [ ] `preview` (if present) passes the same checks and its answers match the question types.
- [ ] No string contains `<script`, `javascript:`, or a `data:text/html` URL (defense in depth; rendering is text-only anyway).

---

## 12. Complete example — Palette Oracle

This is the reference app. It demonstrates inputs, four question types (three of them), transforms, a builtin, templates, and the main display components.

```json
{
  "schema": "jevil/app@1",
  "meta": {
    "title": "Palette Oracle",
    "tagline": "A word goes in. A palette comes out.",
    "description": "Type a word and let a decision model read its temperature, energy, and depth. The result is a five-color palette, a generative field, and the probabilities behind the reading.",
    "tags": ["color", "generative", "wordplay"],
    "accent": "violet",
    "icon": "🎨",
    "engine": { "media": ["text"], "recommended": ["jev", "laya", "clef"] },
    "autorun": false
  },
  "preview": {
    "inputs": { "word": "petrichor" },
    "answers": {
      "read": {
        "family": {
          "type": "choice",
          "choice": "earthy",
          "confidence": 0.71,
          "probabilities": {
            "calm": 0.08,
            "electric": 0.02,
            "earthy": 0.71,
            "nostalgic": 0.1,
            "luxe": 0.04,
            "playful": 0.05
          }
        },
        "warmth": {
          "type": "score",
          "score": 0.665,
          "confidence": 0.58,
          "probabilities": { "0": 0.02, "1": 0.08, "2": 0.22, "3": 0.58, "4": 0.1 }
        },
        "energy": {
          "type": "score",
          "score": 0.353,
          "confidence": 0.51,
          "probabilities": { "0": 0.12, "1": 0.5, "2": 0.26, "3": 0.09, "4": 0.03 }
        },
        "depth": {
          "type": "score",
          "score": 0.575,
          "confidence": 0.49,
          "probabilities": { "0": 0.04, "1": 0.14, "2": 0.36, "3": 0.4, "4": 0.06 }
        }
      }
    }
  },
  "inputs": [
    {
      "id": "word",
      "type": "text",
      "label": "Give me a word",
      "placeholder": "petrichor",
      "default": "petrichor",
      "maxLength": 64,
      "required": true
    }
  ],
  "steps": [
    {
      "id": "read",
      "kind": "decide",
      "label": "Read the word",
      "state": { "template": "The user's word is: {{inputs.word}}" },
      "questions": {
        "family": {
          "type": "choice",
          "instructions": "Which color family best captures the feeling of this word?",
          "criteria": {
            "calm": "still, soft, quiet, water",
            "electric": "sharp, loud, digital, neon",
            "earthy": "soil, clay, moss, wood",
            "nostalgic": "faded, warm, remembered, paper",
            "luxe": "rich, dark, polished, velvet",
            "playful": "bright, candy, silly, pop"
          }
        },
        "warmth": {
          "type": "score",
          "instructions": "How warm or cool does this word feel?",
          "criteria": ["icy", "cool", "neutral", "warm", "hot"]
        },
        "energy": {
          "type": "score",
          "instructions": "How energetic is this word?",
          "criteria": ["still", "gentle", "moving", "lively", "kinetic"]
        },
        "depth": {
          "type": "score",
          "instructions": "How light or deep should the palette be?",
          "criteria": ["pale", "light", "mid", "deep", "midnight"]
        }
      }
    }
  ],
  "vars": {
    "hue": {
      "type": "number",
      "from": { "step": "read", "question": "warmth" },
      "transform": [{ "op": "lerp", "in": [0, 1], "out": [205, 18] }]
    },
    "saturation": {
      "type": "number",
      "from": { "step": "read", "question": "energy" },
      "transform": [{ "op": "lerp", "in": [0, 1], "out": [18, 82] }]
    },
    "lightness": {
      "type": "number",
      "from": { "step": "read", "question": "depth" },
      "transform": [{ "op": "lerp", "in": [0, 1], "out": [78, 28] }]
    },
    "harmony": {
      "type": "string",
      "from": { "step": "read", "question": "family" },
      "transform": [
        {
          "op": "lookup",
          "map": {
            "calm": "analogous",
            "electric": "triadic",
            "earthy": "split",
            "nostalgic": "monochrome",
            "luxe": "complementary",
            "playful": "tetradic"
          },
          "default": "analogous"
        }
      ]
    },
    "colors": {
      "type": "color[]",
      "fn": "palette",
      "args": {
        "hue": { "var": "hue" },
        "saturation": { "var": "saturation" },
        "lightness": { "var": "lightness" },
        "harmony": { "var": "harmony" },
        "count": 5
      }
    },
    "confidencePct": {
      "type": "string",
      "from": { "step": "read", "question": "family", "pick": "confidence" },
      "transform": [{ "op": "percent", "decimals": 0 }]
    }
  },
  "ui": {
    "type": "Stack",
    "id": "root",
    "props": { "direction": "column", "gap": 6 },
    "children": [
      {
        "type": "Heading",
        "id": "title",
        "props": { "level": 2, "text": { "template": "“{{inputs.word}}”" } }
      },
      {
        "type": "Text",
        "id": "subtitle",
        "props": {
          "text": {
            "template": "reads as {{steps.read.family.choice}} — {{vars.confidencePct}} sure."
          },
          "tone": "muted"
        }
      },
      {
        "type": "Canvas",
        "id": "field",
        "props": {
          "height": 300,
          "paint": "palette-field",
          "colors": { "var": "colors" },
          "energy": { "step": "read", "question": "energy" },
          "seed": { "template": "{{inputs.word}}" }
        }
      },
      {
        "type": "Palette",
        "id": "swatches",
        "props": { "colors": { "var": "colors" }, "labels": true }
      },
      {
        "type": "Stack",
        "id": "dials",
        "props": { "direction": "row", "gap": 2 },
        "children": [
          {
            "type": "ScoreDial",
            "id": "dial-warmth",
            "props": { "label": "warmth", "value": { "step": "read", "question": "warmth" } }
          },
          {
            "type": "ScoreDial",
            "id": "dial-energy",
            "props": { "label": "energy", "value": { "step": "read", "question": "energy" } }
          },
          {
            "type": "ScoreDial",
            "id": "dial-depth",
            "props": { "label": "depth", "value": { "step": "read", "question": "depth" } }
          }
        ]
      },
      {
        "type": "ProbabilityBars",
        "id": "probabilities",
        "props": {
          "label": "other readings",
          "probabilities": { "step": "read", "question": "family", "pick": "probabilities" }
        }
      },
      {
        "type": "Button",
        "id": "again",
        "props": { "label": "Read it again", "variant": "secondary", "action": { "kind": "run" } }
      }
    ]
  }
}
```

---

## 13. Authoring recipes

### 13.1 A score → a visual parameter

```json
{
  "type": "number",
  "from": { "step": "read", "question": "energy" },
  "transform": [{ "op": "lerp", "in": [0, 1], "out": [8, 72] }]
}
```

Use `lerp` for hue, saturation, lightness, size, rotation, and opacity. Keep ranges narrow enough that every result looks intentional.

### 13.2 A choice → a preset

```json
{
  "type": "string",
  "from": { "step": "read", "question": "family" },
  "transform": [
    {
      "op": "lookup",
      "map": { "calm": "analogous", "electric": "triadic", "earthy": "split" },
      "default": "analogous"
    }
  ]
}
```

Choices are good at picking a *strategy* (harmony, layout, tone). Scores are good at picking *intensity*. Combine them.

### 13.3 Probabilities → transparency

```json
{
  "type": "ProbabilityBars",
  "id": "probs",
  "props": {
    "label": "how sure?",
    "probabilities": { "step": "read", "question": "family", "pick": "probabilities" }
  }
}
```

Show confidence somewhere in every app. It is part of the product's honesty.

### 13.4 A template that reads naturally

```json
{
  "text": {
    "template": "“{{inputs.word}}” reads {{steps.read.energy.score}} on energy."
  }
}
```

Avoid exposing raw `0.342` values. Format them with `percent` or `formatNumber` vars.

### 13.5 A conditional block

```json
{
  "type": "Badge",
  "id": "warn",
  "visible": { "step": "read", "question": "escalate", "pick": "noul" },
  "props": { "text": "needs a human", "tone": "tangerine" }
}
```

`visible` uses the coercion rule from §8: a `noul` above `0.5` shows the block, a `noul` at or below `0.5` hides it. For finer control, derive a boolean var with a `lookup` or add a `threshold` transform in a future additive change.

---

## 14. Anti-patterns

- **Don't** put instructions in `state`. State is evidence; questions are instructions.
- **Don't** ask a decision model to "write" or "generate" anything. It returns choices, scores, and probabilities.
- **Don't** use 20 questions when 4 will do. Every question costs input tokens and attention.
- **Don't** hide confidence. A confident-looking app with a 51% decision is a lie.
- **Don't** use arbitrary CSS or HTML. The design system exists so apps look like JEVIL, not like a broken MySpace page.
- **Don't** make the palette random. Seed it from inputs and answers so the same word feels the same.
- **Don't** store user input in the blueprint, preview, or analytics.

---

## 15. Versioning and migration

- `jevil/app@1` is the frozen major line once the first public app ships.
- **Additive** changes (new optional prop, new builtin, new component) keep the `schema` string and must render old apps unchanged. The runtime reports a separate build version for diagnostics.
- **Breaking** changes bump the major: `jevil/app@2`. The editor must offer a migration; published v1 apps keep running on the v1 runtime.
- Unknown fields are rejected in v1 (strict schema). This keeps typos visible and makes migrations honest.
- The runtime ships a `schemaVersion` in every run event for analytics.

---

## 16. Editor ↔ format mapping

| Editor concept | JSON |
| --- | --- |
| App name | `meta.title` |
| Tagline | `meta.tagline` |
| Accent color | `meta.accent` |
| Icon | `meta.icon` |
| Input card | `inputs[]` |
| "Decide" block | `steps[]` |
| Question editor | `steps[].questions` |
| Variable card | `vars{}` |
| Canvas node | `ui` tree |
| Binding picker | `Binding` |
| Test bench answers | `preview.answers` (capture) |
| Publish | `app_version.blueprint_json` |

The editor never invents syntax outside this document. If a UI control cannot be expressed here, the format is missing something — add it deliberately, with a version bump and tests.
