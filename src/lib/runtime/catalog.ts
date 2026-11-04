/**
 * The `jevil/app@1` component catalog (APP-FORMAT §8.1).
 *
 * This is the allowlist the validator and the renderer share: component names,
 * container-ness, prop types, ranges, and defaults. Adding a component here is
 * an additive format change; removing or retyping a prop is breaking.
 */

export type PropType =
    | "any"
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "color"
    | "colors"
    | "strings"
    | "record"
    | "enum"
    | "action";

export interface PropSpec {
    type: PropType;
    /** Allowed values for `enum`. */
    values?: readonly string[];
    min?: number;
    max?: number;
    maxLength?: number;
    /** Maximum item count for `colors` / `strings`. */
    itemMax?: number;
    /** Prop must name a declared input, and the input type must match. */
    inputRef?: boolean;
    default?: unknown;
}

export interface ComponentSpec {
    container: boolean;
    required: readonly string[];
    props: Record<string, PropSpec>;
}

export const iconNames = [
    "spark",
    "palette",
    "arrow-right",
    "check",
    "x",
    "plus",
    "minus",
    "play",
    "reset",
    "copy",
    "link",
    "info",
    "warning",
    "shuffle"
] as const;

export type IconName = (typeof iconNames)[number];

export const accents = ["blue", "pink", "lime", "tangerine", "violet", "sky"] as const;

export const tones = ["neutral", "blue", "pink", "lime", "tangerine", "violet"] as const;

const align = ["start", "center"] as const;

export const componentCatalog: Record<string, ComponentSpec> = {
    Stack: {
        container: true,
        required: [],
        props: {
            direction: { type: "enum", values: ["column", "row"], default: "column" },
            gap: { type: "integer", min: 0, max: 12, default: 4 },
            align: { type: "enum", values: ["start", "center", "end", "stretch"] },
            justify: { type: "enum", values: ["start", "center", "end", "between"] },
            padding: { type: "integer", min: 0, max: 8 },
            wrap: { type: "boolean", default: false }
        }
    },
    Grid: {
        container: true,
        required: [],
        props: {
            columns: { type: "integer", min: 1, max: 6, default: 2 },
            gap: { type: "integer", min: 0, max: 8 },
            align: { type: "enum", values: ["start", "stretch"] }
        }
    },
    Card: {
        container: true,
        required: [],
        props: {
            tone: { type: "enum", values: ["paper", "tint", "ink"], default: "paper" },
            padding: { type: "integer", min: 0, max: 8 },
            radius: { type: "enum", values: ["sm", "md", "lg"] }
        }
    },
    Spacer: {
        container: false,
        required: ["size"],
        props: { size: { type: "integer", min: 0, max: 16 } }
    },
    Divider: {
        container: false,
        required: [],
        props: { label: { type: "string", maxLength: 80 } }
    },

    TextInput: {
        container: false,
        required: ["input"],
        props: {
            input: { type: "string", inputRef: true },
            label: { type: "string", maxLength: 80 },
            placeholder: { type: "string", maxLength: 200 },
            maxLength: { type: "integer", min: 1, max: 500 }
        }
    },
    TextArea: {
        container: false,
        required: ["input"],
        props: {
            input: { type: "string", inputRef: true },
            label: { type: "string", maxLength: 80 },
            rows: { type: "integer", min: 2, max: 10 },
            maxLength: { type: "integer", min: 1, max: 4000 }
        }
    },
    Select: {
        container: false,
        required: ["input"],
        props: {
            input: { type: "string", inputRef: true },
            label: { type: "string", maxLength: 80 }
        }
    },
    Slider: {
        container: false,
        required: ["input"],
        props: {
            input: { type: "string", inputRef: true },
            label: { type: "string", maxLength: 80 },
            showValue: { type: "boolean" }
        }
    },
    Toggle: {
        container: false,
        required: ["input"],
        props: {
            input: { type: "string", inputRef: true },
            label: { type: "string", maxLength: 80 }
        }
    },
    ColorInput: {
        container: false,
        required: ["input"],
        props: {
            input: { type: "string", inputRef: true },
            label: { type: "string", maxLength: 80 }
        }
    },

    Heading: {
        container: false,
        required: ["text"],
        props: {
            text: { type: "any" },
            level: { type: "integer", min: 1, max: 4, default: 2 },
            align: { type: "enum", values: align }
        }
    },
    Text: {
        container: false,
        required: ["text"],
        props: {
            text: { type: "any" },
            size: { type: "enum", values: ["sm", "md", "lg"], default: "md" },
            tone: { type: "enum", values: ["default", "muted", "accent"], default: "default" },
            align: { type: "enum", values: align }
        }
    },
    Badge: {
        container: false,
        required: ["text"],
        props: {
            text: { type: "any" },
            tone: { type: "enum", values: tones, default: "neutral" }
        }
    },
    Stat: {
        container: false,
        required: ["label", "value"],
        props: {
            label: { type: "string", maxLength: 80 },
            value: { type: "any" },
            hint: { type: "string", maxLength: 160 }
        }
    },
    Meter: {
        container: false,
        required: ["value"],
        props: {
            value: { type: "number", min: 0, max: 1 },
            label: { type: "string", maxLength: 80 },
            tone: { type: "enum", values: tones }
        }
    },
    ScoreDial: {
        container: false,
        required: ["label", "value"],
        props: {
            label: { type: "string", maxLength: 80 },
            value: { type: "number", min: 0, max: 1 },
            levels: { type: "strings", min: 2, max: 10, maxLength: 60 }
        }
    },
    ProbabilityBars: {
        container: false,
        required: ["probabilities"],
        props: {
            label: { type: "string", maxLength: 80 },
            probabilities: { type: "record" },
            highlight: { type: "string", maxLength: 80 }
        }
    },
    Palette: {
        container: false,
        required: ["colors"],
        props: {
            colors: { type: "colors" },
            labels: { type: "boolean", default: false },
            size: { type: "enum", values: ["sm", "md", "lg"], default: "md" }
        }
    },
    Canvas: {
        container: false,
        required: ["height", "paint"],
        props: {
            height: { type: "integer", min: 120, max: 480 },
            paint: { type: "enum", values: ["palette-field", "stripes", "grain", "orb"] },
            colors: { type: "colors" },
            energy: { type: "number", min: 0, max: 1 },
            seed: { type: "string", maxLength: 200 },
            background: { type: "color" }
        }
    },
    Shape: {
        container: false,
        required: ["kind"],
        props: {
            kind: { type: "enum", values: ["blob", "ring", "star", "squiggle"] },
            color: { type: "color" },
            size: { type: "integer", min: 24, max: 240 },
            rotate: { type: "number", min: -180, max: 180 }
        }
    },
    List: {
        container: false,
        required: ["items"],
        props: {
            items: { type: "strings", itemMax: 50, maxLength: 500 },
            ordered: { type: "boolean" },
            marker: { type: "enum", values: ["dot", "number", "none"] }
        }
    },
    Icon: {
        container: false,
        required: ["name"],
        props: {
            name: { type: "enum", values: iconNames },
            size: { type: "integer", min: 16, max: 48 },
            color: { type: "color" }
        }
    },
    ConfidenceChip: {
        container: false,
        required: ["value"],
        props: {
            value: { type: "number", min: 0, max: 1 },
            label: { type: "string", maxLength: 80 }
        }
    },
    Skeleton: {
        container: false,
        required: ["height"],
        props: {
            height: { type: "integer", min: 8, max: 240 },
            width: { type: "enum", values: ["full", "half"] }
        }
    },
    ErrorNote: {
        container: false,
        required: ["message"],
        props: {
            title: { type: "string", maxLength: 80 },
            message: { type: "any" }
        }
    },
    EmptyState: {
        container: false,
        required: ["title", "message"],
        props: {
            title: { type: "any" },
            message: { type: "any" },
            icon: { type: "enum", values: iconNames }
        }
    },

    Button: {
        container: false,
        required: ["label", "action"],
        props: {
            label: { type: "any" },
            variant: {
                type: "enum",
                values: ["primary", "secondary", "ghost", "danger"],
                default: "primary"
            },
            action: { type: "action" },
            disabled: { type: "boolean" },
            fullWidth: { type: "boolean" }
        }
    },
    IconButton: {
        container: false,
        required: ["icon", "label", "action"],
        props: {
            icon: { type: "enum", values: iconNames },
            label: { type: "any" },
            action: { type: "action" },
            variant: { type: "enum", values: ["primary", "secondary", "ghost", "danger"] }
        }
    }
};

/** Input components must point at the matching input type. */
export const inputComponentTypes: Record<string, string> = {
    TextInput: "text",
    TextArea: "textarea",
    Select: "select",
    Slider: "slider",
    Toggle: "toggle",
    ColorInput: "color"
};
