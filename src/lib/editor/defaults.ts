/**
 * Starting nodes for the palette. Every default satisfies the catalog's
 * required props, so a click-to-add never creates a knowingly broken node.
 * Input components point at the first matching input; the palette disables
 * them when no input fits.
 */

import { componentCatalog, inputComponentTypes, type ComponentSpec } from "#lib/runtime/catalog";
import type { AppInput, PropValue, UiNode } from "#lib/schema/blueprint";

export interface PaletteGroup {
    id: string;
    label: string;
    components: string[];
}

export const paletteGroups: PaletteGroup[] = [
    {
        id: "layout",
        label: "Layout",
        components: ["Stack", "Grid", "Card", "Spacer", "Divider"]
    },
    {
        id: "input",
        label: "Input",
        components: ["TextInput", "TextArea", "Select", "Slider", "Toggle", "ColorInput"]
    },
    {
        id: "display",
        label: "Display",
        components: [
            "Heading",
            "Text",
            "Badge",
            "Stat",
            "Meter",
            "ScoreDial",
            "ProbabilityBars",
            "Palette",
            "Canvas",
            "Shape",
            "List",
            "Icon",
            "ConfidenceChip"
        ]
    },
    {
        id: "feedback",
        label: "Feedback",
        components: ["Skeleton", "ErrorNote", "EmptyState"]
    },
    {
        id: "action",
        label: "Action",
        components: ["Button", "IconButton"]
    }
];

const DEFAULT_PROPS: Record<string, Record<string, PropValue>> = {
    Stack: { direction: "column", gap: 4 },
    Grid: { columns: 2, gap: 4 },
    Card: { tone: "paper", padding: 5, radius: "md" },
    Spacer: { size: 4 },
    Divider: {},
    Heading: { text: "Heading", level: 2 },
    Text: { text: "Text", tone: "default" },
    Badge: { text: "Badge", tone: "neutral" },
    Stat: { label: "Label", value: "—" },
    Meter: { value: 0.5 },
    ScoreDial: { label: "Score", value: 0.5, levels: ["low", "high"] },
    ProbabilityBars: { probabilities: { low: 0.5, high: 0.5 } },
    Palette: { colors: ["#8b5cf6", "#b9f24d", "#f6f2e9"] },
    Canvas: { height: 180, paint: "stripes" },
    Shape: { kind: "blob" },
    List: { items: ["One", "Two"] },
    Icon: { name: "spark" },
    ConfidenceChip: { value: 0.5 },
    Skeleton: { height: 24 },
    ErrorNote: { message: "Something went wrong." },
    EmptyState: { title: "Nothing here", message: "Add something to see it." },
    Button: { label: "Run", action: { kind: "run" } },
    IconButton: { icon: "play", label: "Run", action: { kind: "run" } }
};

/** The input an input component should point at, or `null` when none fits. */
export const inputFor = (type: string, inputs: AppInput[]): AppInput | null => {
    const wanted = inputComponentTypes[type];
    if (!wanted) return null;
    return inputs.find((input) => input.type === wanted) ?? null;
};

export const canAdd = (type: string, inputs: AppInput[]): boolean =>
    !(type in inputComponentTypes) || inputFor(type, inputs) !== null;

export const isContainer = (type: string): boolean => componentCatalog[type]?.container === true;

export const defaultNode = (type: string, id: string, inputs: AppInput[]): UiNode => {
    const input = inputFor(type, inputs);
    const props: Record<string, PropValue> = { ...(DEFAULT_PROPS[type] ?? {}) };

    if (input) {
        props.input = input.id;
        props.label = input.label;
    }

    const node: UiNode = { type, id, props };

    if (isContainer(type)) node.children = [];

    return node;
};

/** Label for a palette button: component name plus its required prop shape. */
export const componentSummary = (type: string, spec: ComponentSpec | undefined): string => {
    if (!spec) return type;
    if (spec.required.length === 0) return spec.container ? "Container" : "Display";
    return `Needs ${spec.required.join(", ")}`;
};
