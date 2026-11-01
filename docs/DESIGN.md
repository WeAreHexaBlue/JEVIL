# JEVIL — Design System

> **Status:** draft · v0.1 · 2026-11-01
> **Direction:** Expressive minimal hybrid — [hexa.blue](https://hexa.blue)'s restraint + Material 3 Expressive's chunky, springy confidence.
> **Companion docs:** [SPEC.md](../SPEC.md) · [App format](./APP-FORMAT.md) · [Roadmap](../ROADMAP.md)

The design should feel like a **small design studio's toy shelf**, not an AI product. Warm paper, big type, crisp edges, one electric blue, and a few loud accents. The apps are the color; the chrome stays quiet.

---

## 1. What we take, what we leave

### From hexa.blue

- Generous whitespace and a near-empty canvas.
- Oversized, tightly tracked display type.
- Almost no chrome: no gradients everywhere, no glass, no drop-shadow soup.
- Confident black-on-paper contrast.
- A single blue accent used sparingly.

### From Material 3 Expressive

- Chunky, friendly shapes and pill controls.
- Tonal surfaces instead of borders everywhere.
- Springy press/hover feedback with a little overshoot.
- Bold color used as a wayfinding tool, not decoration.
- Large, legible controls and a clear hierarchy.

### What we avoid

- Chat bubbles, avatars, typing indicators, streaming text.
- Purple-to-blue gradients on near-black ("default AI startup").
- Glassmorphism, neon glows, floating 3D blobs.
- Uniform 3×N card grids with identical cards.
- Mascots, confetti, emoji confetti, "magic" sparkles as a brand.
- Tiny gray text on gray backgrounds.
- Motion that loops forever or blocks reading.

---

## 2. Brand

**Name:** JEVIL. Always uppercase in the wordmark, sentence case in prose ("Jevil").

**Tagline:** *Small apps. Sharp decisions.*

**One-liner:** A marketplace for tiny apps powered by decision models — not chat.

**Logo:** a hexagonal "decision prism" split into three facets (choice / score / yes-no) with the blue→sky gradient from HexaBlue. Paired with the JEVIL wordmark in Bricolage Grotesque 700, tracking `-0.04em`. The mark works at 24 px; the wordmark is hidden below 480 px.

**Voice:** dry, warm, specific. Short sentences. Verbs first. No hype.

| Say | Don't say |
| --- | --- |
| "A word goes in. A palette comes out." | "Unleash the power of AI color generation." |
| "Plug in a model." | "Connect your AI provider." |
| "71% sure." | "High confidence!" |
| "Your key stays yours." | "Enterprise-grade security." |
| "Make a tiny thing." | "Build your next revolutionary app." |

---

## 3. Principles

1. **The app is the hero.** Chrome recedes; the result gets the space.
2. **One loud color per screen.** Blue is the action color; accent tones belong to apps and data.
3. **Big type, few words.** If a label needs a paragraph, the design is wrong.
4. **Soft surfaces, crisp edges.** Rounded shapes, 1 px lines, no blurry borders.
5. **Motion explains, never performs.** Spring on press, stagger on results, nothing on scroll.
6. **Honest data.** Confidence is visible and labeled; color is never the only signal.

---

## 4. Color

### 4.1 Core palette

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#F6F2E9` | Page background |
| `paper-2` | `#EFE9DC` | Recessed surfaces, canvas, inputs |
| `paper-3` | `#E6DECE` | Tracks, dividers, hover fills |
| `ink` | `#16150F` | Primary text, primary buttons |
| `ink-2` | `#3D3A32` | Secondary text |
| `muted` | `#6B665A` | Helper text, metadata |
| `line` | `#D8D0C0` | Hairlines, borders |
| `blue` | `#006EFF` | Primary action, links, focus |
| `sky` | `#00BFFF` | Gradient partner, informational |
| `pink` | `#FF5D8F` | Playful accent, "hot" data |
| `lime` | `#C8F45A` | Success, "go" data |
| `tangerine` | `#FF8A3D` | Warning, "warm" data |
| `violet` | `#7C5CFF` | Creative accent, "cool" data |
| `red` | `#D9480F` | Destructive, errors |
| `green` | `#0E8A5F` | Success text (contrast-safe) |

**Blue gradient:** `linear-gradient(135deg, #006EFF 0%, #00BFFF 100%)`. Use for the logo, one hero detail, and canvas paint. Never as a full-page background.

### 4.2 Tonal surfaces

Tones are derived by mixing an accent with `paper` at low opacity:

```
tone-bg(accent)   = color-mix(in oklab, var(--accent) 12%, var(--paper))
tone-line(accent) = color-mix(in oklab, var(--accent) 28%, var(--line))
tone-ink(accent)  = color-mix(in oklab, var(--accent) 60%, var(--ink))
```

App cards and result panels can set `--accent` from `meta.accent`; the rest of the UI stays blue.

### 4.3 Dark mode (ready, not shipped in v1)

| Token | Dark value |
| --- | --- |
| `paper` | `#12110D` |
| `paper-2` | `#1B1914` |
| `paper-3` | `#26231B` |
| `ink` | `#F4EFE3` |
| `ink-2` | `#D6CFC0` |
| `muted` | `#A8A296` |
| `line` | `#332F26` |

Accents stay the same but are desaturated by 8%. Audit contrast before enabling.

### 4.4 Color rules

- Text on `paper`: `ink` or `ink-2`. Never `muted` below 14 px.
- Buttons: blue bg + white text; ink bg + paper text for secondary emphasis.
- Never use color alone to encode a choice, score, or error. Pair with a label, number, or icon.
- App accents are functional: they tint the app card, the result panel, and the primary button inside the runner.
- Maximum two accent colors visible at once (blue + the app's accent).

---

## 5. Typography

### 5.1 Families

| Role | Family | Weights | Notes |
| --- | --- | --- | --- |
| Display | **Bricolage Grotesque Variable** | 500–800 | Tight tracking, slightly quirky; headlines and numerals |
| UI / body | **Instrument Sans Variable** | 400–700 | Calm, neutral, excellent at 14–18 px |
| Code / data | **JetBrains Mono** | 400–600 | Hex values, JSON, probabilities, editor |

Self-host via Fontsource:

```ts
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "@fontsource-variable/jetbrains-mono";
```

Subset Latin, `font-display: swap`, preload the display face only.

### 5.2 Scale

| Token | Desktop | Mobile | Line-height | Tracking | Use |
| --- | --- | --- | --- | --- | --- |
| `display-xl` | 96 px | 56 px | 0.92 | −0.05em | Home hero only |
| `display` | 72 px | 44 px | 0.95 | −0.04em | Section heroes |
| `h1` | 56 px | 38 px | 1.0 | −0.035em | Page titles |
| `h2` | 40 px | 30 px | 1.05 | −0.03em | Section titles |
| `h3` | 28 px | 24 px | 1.15 | −0.02em | Card titles |
| `h4` | 22 px | 20 px | 1.25 | −0.01em | Subheads |
| `body-lg` | 19 px | 18 px | 1.55 | 0 | Intros |
| `body` | 16 px | 16 px | 1.6 | 0 | Default |
| `small` | 14 px | 13 px | 1.5 | 0 | Metadata |
| `micro` | 12 px | 11 px | 1.4 | 0.04em | Labels, chips |
| `mono` | 13 px | 12 px | 1.5 | 0 | Code, hex, JSON |

Use `clamp()` for fluid display sizes:

```css
--text-display: clamp(2.75rem, 7vw, 4.5rem);
--text-hero: clamp(3.5rem, 10vw, 6rem);
```

### 5.3 Rules

- Display type is always sentence case, never all caps.
- Eyebrows are `micro`, uppercase, tracking `0.12em`, `muted` or `blue`.
- Body measure: 58–68 characters. Never full-width paragraphs.
- Numbers in stats and dials use `font-variant-numeric: tabular-nums`.
- Max two weights per screen (e.g. 500 + 700).
- Don't set body copy in Bricolage; it gets tiring below 24 px.
- Links are underlined by default, blue, with a 2 px offset.

---

## 6. Space, grid, shape

### 6.1 Spacing scale

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160`

- Section padding: 96–160 px desktop, 56–72 px mobile.
- Card padding: 20–28 px.
- Control gap: 12–16 px.
- Dense UI (editor inspector): 8–12 px.

### 6.2 Layout

- Container: `max-width: 1240px`, 24 px gutters (16 px mobile).
- 12-column grid; gap 24 px.
- Home hero: 7/5 split. Catalog: 3 columns desktop, 2 tablet, 1 mobile.
- App detail: 7/5 split; runner on the left, metadata on the right.
- Editor: 260 px palette / fluid canvas / 320 px inspector; collapses to sheets below 1024 px.
- Sticky elements: top nav (64 px), mobile run bar (72 px), editor top bar (56 px).

### 6.3 Radii

| Token | Value | Use |
| --- | --- | --- |
| `xs` | 6 px | Tiny chips, swatches |
| `sm` | 12 px | Inputs, small buttons |
| `md` | 20 px | Cards, panels |
| `lg` | 28 px | Hero cards, canvas |
| `xl` | 36 px | Sheets, large surfaces |
| `full` | 999 px | Pills, avatars |

### 6.4 Borders and shadows

```css
--border: 1px solid var(--line);
--border-strong: 1.5px solid var(--ink);
--shadow-soft: 0 1px 2px rgb(22 21 15 / 0.04), 0 12px 32px rgb(22 21 15 / 0.06);
--shadow-lift: 0 2px 0 var(--ink), 0 18px 40px rgb(22 21 15 / 0.10);
--shadow-press: inset 0 2px 0 rgb(22 21 15 / 0.12);
```

- "Sticker" elements (featured badges, one hero card) use a 1.5 px ink border + offset shadow, no blur.
- Standard cards use `--shadow-soft` and no border.
- Never stack more than one shadow layer beyond these tokens.

### 6.5 Grain

A fixed, 3% opacity grain overlay adds warmth without noise:

```css
body::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,..."); /* feTurbulence */
  z-index: 50;
}
```

Disable under `prefers-reduced-transparency` and in the editor canvas (it interferes with precision).

---

## 7. Motion

### 7.1 Curves and durations

```css
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--dur-instant: 80ms;
--dur-fast: 140ms;
--dur-base: 220ms;
--dur-slow: 360ms;
--dur-morph: 520ms;
```

### 7.2 Choreography

| Moment | Motion |
| --- | --- |
| Button press | `scale(0.97)` 80 ms spring, release 220 ms |
| Card hover | `translateY(-4px) rotate(-1deg)`, shadow lift, 220 ms |
| Page enter | opacity 0→1 + `translateY(6px)`, 220 ms |
| Result enter | opacity + `translateY(10px)`, 320 ms; content staggers 40 ms |
| Palette swatches | stagger 40 ms, scale 0.96→1 |
| Score dial | stroke sweep 600 ms `--ease-out` |
| Probability bars | width 0→value, 500 ms, stagger 30 ms |
| Sheet/dialog | translateY(24px)→0 + fade, 280 ms spring |
| "Thinking" | one soft shimmer sweep, 1.2 s, then stop; no infinite spinner |
| Toast | slide up + fade, 200 ms; auto-dismiss 3 s |

### 7.3 Rules

- Never animate `width`, `height`, or `top` on scroll. Use transform/opacity.
- No parallax, no scroll-jacking, no auto-playing carousels.
- Respect `prefers-reduced-motion: reduce`: set durations to 0, remove transforms, keep opacity transitions ≤120 ms.
- Focus rings never animate.
- Motion must not delay access to content: results render immediately, then animate in.

---

## 8. Components

### 8.1 Button

- Pill, min-height 44 px, padding 12×20 px, `body` 15 px / 600.
- **Primary:** blue bg, white text. Hover: darken 6%. Active: scale 0.97.
- **Secondary:** paper bg, 1.5 px ink border, ink text. Hover: paper-2.
- **Ghost:** transparent, ink text. Hover: paper-2.
- **Danger:** red bg, white text.
- Disabled: 40% opacity, no motion, `cursor: not-allowed`.
- Loading: label swaps to a short verb ("Reading…") + three-dot pulse; width stays stable.
- Icon buttons: 44×44, 20 px icon, `aria-label` required.

### 8.2 Inputs

- Height 48 px (textarea auto), 14 px radius, `paper-2` bg, 1.5 px `line` border.
- Label above, 13 px / 600. Help below, 12 px `muted`. Error below, 12 px `red`.
- Focus: blue border + 3 px blue ring at 20% opacity.
- Placeholder: `muted` at 70%.
- Select: native `<select>` styled, chevron icon, no custom dropdown in v1.
- Slider: 6 px track `paper-3`, 18 px thumb ink with 2 px paper ring; value shown in mono.
- Toggle: 44×26 pill, ink when on, paper-3 when off; spring thumb.
- Color input: 44×44 swatch + hex text in mono.

### 8.3 Card

- 24 px radius, `paper` bg, 1 px `line` or `--shadow-soft`, 24 px padding.
- Hover: lift + 1° tilt (only on interactive cards).
- **App card anatomy:** accent strip or tinted preview (top, 16:10), title (`h3`), tagline (`small`, `muted`, 2 lines max), footer with author avatar/initial, run count, tags.
- **Sticker variant:** 1.5 px ink border + offset shadow; used sparingly for featured apps.

### 8.4 Chips and badges

- Pill, 28 px height, 12 px / 600, padding 6×12.
- Neutral: `paper-3` bg, `ink-2` text.
- Tone: accent at 14% bg, `tone-ink` text.
- Filter chip active: ink bg, paper text.
- Confidence chip: dot + "71% sure"; neutral tone; tooltip explains probabilities.

### 8.5 Navigation

- Height 64 px, paper bg, bottom hairline on scroll.
- Logo left; primary links ("Apps", "Make", "How it works") center-left; right: connection chip, "Sign in", primary CTA.
- Mobile: logo + "Make" + menu button; full-screen sheet menu with large links.
- Active link: ink text + 2 px blue underline offset 6 px.
- Skip link: first focusable element, visible on focus.

### 8.6 Dialogs and sheets

- Desktop: centered card, max-width 520 px, 28 px radius, `--shadow-lift`, backdrop `ink/30` + 4 px blur.
- Mobile: bottom sheet, 28 px top radius, drag handle, safe-area padding.
- One primary action, one ghost cancel. Destructive actions use red and require confirmation.
- Focus trap, `Esc` closes, restore focus on close.

### 8.7 Toast

- Bottom center, ink bg, paper text, pill, 12 px / 600, 12×20 padding.
- One at a time; queue the rest. `role="status"`.

### 8.8 Segmented control

- Container `paper-2`, 999 px radius, 4 px padding.
- Active segment: paper bg, soft shadow, ink text; thumb springs between segments.
- Used for catalog sort and editor device width.

### 8.9 Meters, dials, bars

- **Meter:** 10 px track `paper-3`, fill accent, 999 px radius; label left, value right in mono.
- **ScoreDial:** 120 px SVG ring, 10 px stroke, track `paper-3`, fill accent, center value 28 px / 700, label 12 px `muted`. Animate `stroke-dashoffset`.
- **ProbabilityBars:** rows of label (80 px) + bar + percent (mono 12 px). Winner gets ink fill; others accent at 60%. Bars animate width.
- **Palette:** 5 equal swatches, 64 px tall, 16 px radius, 4 px gap; hex label under each in mono 11 px; click to copy. Text overlay uses `contrastText`.
- **Canvas:** 28 px radius, overflow hidden, `paper-2` fallback. Paints are deterministic by seed. Grain overlay at 6% inside the canvas.

### 8.10 Empty, loading, error

- **Empty:** simple geometric illustration (three shapes), `h3`, one sentence, one action. Never a sad robot.
- **Loading:** skeleton that mirrors the result layout (not a spinner), with a single shimmer.
- **Error:** `ErrorNote` with a short title, one sentence of cause, one retry action, and a "details" disclosure for the error code.
- **No connection:** a friendly sheet with provider cards and a "Use a local server" link; copy: "Plug in a model to run this. Your key stays yours."

---

## 9. Page layouts

### 9.1 Home

```
┌──────────────────────────────────────────────────────────────┐
│  ◈ JEVIL     Apps   Make   How it works      [Connect] [Sign in] │
├──────────────────────────────────────────────────────────────┤
│  DECISION MODELS, NOT CHAT                    ┌─────────────┐ │
│  Small apps.                                  │  app card   │ │
│  Sharp decisions.                             │  (tilted)   │ │
│                                               │  ┌────────┐ │ │
│  Tiny apps that turn a choice, a score, or    │  │palette │ │ │
│  a yes/no into something you can see.         │  └────────┘ │ │
│                                               └─────────────┘ │
│  [Browse apps]  [Make one]                                    │
│  Runs on Jev · Laya · Clef · your local model                 │
├──────────────────────────────────────────────────────────────┤
│  01 Pick an app   02 Plug in a model   03 Get a result        │
├──────────────────────────────────────────────────────────────┤
│  Featured                                                     │
│  ┌───────────────────────┐  ┌──────────┐  ┌──────────┐        │
│  │  large app card       │  │  app     │  │  app     │        │
│  │  with live preview    │  │  card    │  │  card    │        │
│  └───────────────────────┘  └──────────┘  └──────────┘        │
├──────────────────────────────────────────────────────────────┤
│  Make a tiny thing.  [mock editor with dotted grid]           │
├──────────────────────────────────────────────────────────────┤
│  footer: logo · apps · make · about · privacy · GitHub        │
└──────────────────────────────────────────────────────────────┘
```

- Hero copy is left-aligned, 7 columns; the card stack is right-aligned, rotated −2°/+3°, overlapping by 24 px.
- One card in the stack is "live": it shows a palette preview and a confidence chip.
- The model strip is mono 12 px, `muted`, separated by `·`.
- "How it works" uses giant numerals in Bricolage 700, `paper-3` color, with 16 px copy below.
- Featured grid is asymmetric: one 2× card, two 1× cards, then a 3-up row. Not a uniform grid.

### 9.2 Catalog

- Header row: `h1 "Apps"` + count in mono; search field right (max 360 px).
- Second row: tag chips (horizontal scroll on mobile) + sort segmented control.
- Grid: 3 columns desktop; featured cards span 2; 2 columns tablet; 1 column mobile.
- Card previews are real renders with `preview.answers`, not screenshots.
- Empty search: "No apps match “xyz”. Try a broader word." + clear action.

### 9.3 App detail

- Breadcrumb: `Apps / Color / Palette Oracle`.
- Left 7 columns: preview panel with a **Run** overlay; result area; "How it decides" accordion.
- Right 5 columns: title, tagline, author row, run count, tags, **Run** and **Remix** buttons, version history, report link.
- On mobile: preview first, sticky bottom bar with Run + Remix.
- Sample badge on preview results; live results replace it with a "live" chip.

### 9.4 Runner

- Top: app title + connection chip + "Change" link.
- Left/top: generated input panel (labeled fields, one column, max 480 px).
- Right/bottom: result panel, full width, min-height 320 px.
- Primary Run button full-width on mobile, inline on desktop.
- After a run: "How this was decided" disclosure with question instructions, chosen answer, confidence, and probability bars.
- Footer note: "Decision models return probabilities, not text. [What's this?]"

### 9.5 Editor

- Top bar: back, app name (inline editable), save status, device segmented control, Preview, Publish.
- Left: component palette with search and groups (Layout, Input, Display, Action); tiles 56 px with icon + label.
- Center: canvas on `paper-2` with a 16 px dotted grid; app rendered inside a paper frame with 28 px radius; selection blue outline + 8 px handles; breadcrumb at top.
- Right: inspector tabs (Props, Style, Bindings) + Variables/Questions sections below; sticky header.
- Bottom: test bench drawer, 280 px, collapsible; inputs, Run, answers (tabs: Pretty / JSON), latency, tokens.
- Drop indicator: 2 px blue line with a small "Drop here" pill.
- Empty canvas: "Drag something in. Start with an Input." + three suggested components.

### 9.6 Auth

- Split screen: left 5 columns paper with form; right 7 columns a large app preview on `paper-2` with a rotating quote.
- Mobile: form only, logo top, no illustration.
- Fields: 48 px, labels above, inline validation, one primary button.
- OAuth buttons: GitHub (ink), Google (paper + border), with icons; "or" divider; email form.
- Copy: "Make an account to publish. Running apps doesn't need one."

### 9.7 Profile

- Header: generated avatar (gradient + initial), handle, display name, bio, joined date, app count.
- Tabs: Published / Remixes / Likes (own profile only).
- Grid of app cards; empty state with "Make your first app."

### 9.8 Admin

- Dense but on-brand: paper background, table with 1 px lines, status chips, no playful motion.
- Report row expands to show app preview, reporter note, and actions (hide, unlist, dismiss).
- Every action shows a confirmation with the audit-log consequence.

---

## 10. App previews and generated visuals

- Previews use the app's `preview.answers` and render instantly; never call a model in the catalog.
- Preview panels have a fixed 16:10 aspect ratio to prevent layout shift.
- The preview is interactive only on the detail page; catalog cards are links, not live apps.
- Generated canvases must look good at 320×200 (card), 640×400 (detail), and 960×600 (runner). Test all three.
- Every canvas has a static fallback for reduced motion and a `paper-2` background while loading.
- Palettes must pass a contrast check for their hex labels; if a swatch is too light, use ink text; if too dark, use paper text.

---

## 11. Copy

### 11.1 Principles

- Write the action, not the technology.
- One idea per sentence.
- Prefer concrete nouns: word, palette, score, key, model.
- Be honest about uncertainty: "71% sure", "the model leaned toward…".
- Never blame the user. Never say "Oops!".

### 11.2 Microcopy bank

| Context | Copy |
| --- | --- |
| Hero eyebrow | `DECISION MODELS, NOT CHAT` |
| Hero H1 | `Small apps. Sharp decisions.` |
| Hero sub | `Tiny apps that turn a choice, a score, or a yes/no into something you can see.` |
| Primary CTA | `Browse apps` |
| Secondary CTA | `Make one` |
| Model strip | `Runs on Jev · Laya · Clef · your local model` |
| Catalog empty | `Nothing here yet. Make the first small thing.` |
| Search empty | `No apps match “{query}”. Try a broader word.` |
| No connection title | `Plug in a model` |
| No connection body | `Use your own key or a local server. It never leaves your browser unless you save it.` |
| Guest key note | `Stored on this device only.` |
| Local note | `Your model, your machine. Nothing leaves your browser.` |
| Run pending | `Reading…` |
| Run error | `The model didn't answer. Check your connection and try again.` |
| Confidence | `{n}% sure` |
| Confidence tooltip | `Decision models return probabilities, not vibes.` |
| Publish success | `It's alive. Share the link.` |
| Remix | `Remix this` |
| Remix attribution | `Remixed from {app} by {author}` |
| Report | `Report this app` |
| Delete draft | `Delete this draft? This can't be undone.` |
| Save conflict | `This draft changed somewhere else. Reload to see the latest.` |
| 404 | `This page decided not to exist.` |
| 500 | `Something broke on our side. Try again in a minute.` |

### 11.3 Tone guardrails

- No exclamation marks except in success toasts (max one).
- No "AI" in the primary UI; say "model" when needed.
- No emoji in UI chrome; app icons may be emoji.
- No jargon: "noul" is a schema term, not user-facing. Say "yes/no".
- No fake urgency, no growth-hack copy.

---

## 12. Accessibility

- **Contrast:** body text ≥4.5:1; large display ≥3:1; UI borders ≥3:1 against adjacent surfaces. Test `muted` on `paper-2` (it is close — darken if needed).
- **Focus:** 3 px blue ring, 2 px offset, never removed. Visible on paper, ink, and accent surfaces.
- **Targets:** 44×44 px minimum, 8 px spacing between adjacent targets.
- **Keyboard:** every flow works without a pointer. Editor drag has a "Move up/down" menu and `Alt+↑/↓`.
- **Semantics:** one `h1` per page; landmarks (`header`, `nav`, `main`, `footer`); buttons are `<button>`, links are `<a>`.
- **Live regions:** run status and results use `aria-live="polite"`; errors use `role="alert"`.
- **Forms:** labels are real `<label>` elements; errors linked with `aria-describedby`; required marked in text, not just color.
- **Color independence:** probabilities have numbers; palettes have hex labels; scores have values; errors have icons + text.
- **Motion:** `prefers-reduced-motion` removes transforms and shortens durations. No autoplay.
- **Zoom:** layout works at 200% zoom and 320 px width.
- **Screen reader:** canvas visuals have a text alternative (`aria-label` summarizing the palette); decorative shapes are `aria-hidden`.

---

## 13. Implementation notes

### 13.1 Tailwind v4 tokens

```css
/* src/app.css */
@import "tailwindcss";

@theme {
  --color-paper: #f6f2e9;
  --color-paper-2: #efe9dc;
  --color-paper-3: #e6dece;
  --color-ink: #16150f;
  --color-ink-2: #3d3a32;
  --color-muted: #6b665a;
  --color-line: #d8d0c0;
  --color-blue: #006eff;
  --color-sky: #00bfff;
  --color-pink: #ff5d8f;
  --color-lime: #c8f45a;
  --color-tangerine: #ff8a3d;
  --color-violet: #7c5cff;
  --color-red: #d9480f;
  --color-green: #0e8a5f;

  --radius-xs: 6px;
  --radius-sm: 12px;
  --radius-md: 20px;
  --radius-lg: 28px;
  --radius-xl: 36px;

  --shadow-soft: 0 1px 2px rgb(22 21 15 / 0.04), 0 12px 32px rgb(22 21 15 / 0.06);
  --shadow-lift: 0 2px 0 var(--color-ink), 0 18px 40px rgb(22 21 15 / 0.10);

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  --font-display: "Bricolage Grotesque Variable", system-ui, sans-serif;
  --font-sans: "Instrument Sans Variable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
}
```

### 13.2 Runtime accent theming

App cards and runner panels set `--accent` from `meta.accent`:

```html
<article class="app-card" style="--accent: var(--color-violet)">
```

```css
.app-card {
  background: color-mix(in oklab, var(--accent) 8%, var(--color-paper));
  border-color: color-mix(in oklab, var(--accent) 24%, var(--color-line));
}
```

### 13.3 Fonts

- Import Fontsource variable packages once in the root layout.
- Preload only Bricolage Grotesque 700.
- `font-display: swap`; use `size-adjust` fallbacks to minimize CLS.

### 13.4 Icons

- One inline SVG component (`Icon.svelte`) with an allowlisted name map.
- 20 px default, 1.75 px stroke, round caps, currentColor.
- No icon fonts, no remote SVGs, no emoji in chrome.

### 13.5 Dark mode

- Use a `.dark` class on `<html>`; tokens swap in `@layer base`.
- Do not ship the toggle until the palette passes contrast and screenshot review.

### 13.6 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Keep opacity transitions if they aid comprehension; remove transforms.

---

## 14. Do / Don't

| Do | Don't |
| --- | --- |
| Let the app result fill the panel | Wrap it in a chat bubble |
| Use one accent per app | Rainbow-gradient every card |
| Show `71% sure` with a tooltip | Hide confidence behind "AI magic" |
| Use a 28 px radius for big surfaces | Round everything to 999 px |
| Animate the result once | Loop a shimmer forever |
| Write "Plug in a model" | Write "Configure your inference provider" |
| Use `paper-2` for recessed panels | Use pure white cards on pure white |
| Use real app renders as previews | Use generic screenshots or stock art |
| Keep the catalog asymmetric | Ship a uniform 3×N card grid |
| Test at 320 px | Assume desktop only |

---

## 15. Visual QA checklist

- [ ] Page has one `h1` and a clear reading order.
- [ ] Blue is used for actions/focus only; app accents are contained.
- [ ] Text contrast passes; `muted` is not used for small body copy.
- [ ] Every interactive element has hover, focus, active, and disabled states.
- [ ] 44 px targets; no overlapping hit areas.
- [ ] Result panel has a pending, success, error, and empty state.
- [ ] Confidence is visible and labeled.
- [ ] Palette/canvas looks intentional at 320, 640, and 960 px.
- [ ] Motion is ≤360 ms and removed under reduced motion.
- [ ] No layout shift when fonts, previews, or results load.
- [ ] Keyboard path works through nav → catalog → detail → run.
- [ ] Mobile sticky bar doesn't cover the footer or inputs.
- [ ] Dark-mode tokens exist and are not accidentally applied.
- [ ] Screenshot review at 390, 768, and 1440 px before merging.
