/**
 * `jevil/app@1` schema and semantic validation (APP-FORMAT §1–§11).
 *
 * Two layers:
 * 1. Zod rejects structural mistakes and unknown fields (v1 is strict).
 * 2. `validateBlueprint` checks everything that needs the whole document:
 *    duplicate ids, binding paths, question references, var cycles, prop
 *    ranges, action refs, preview answers, and size limits.
 *
 * Problems are returned with JSON pointers so an editor can focus the exact
 * node. Nothing here executes app input.
 */

import { z } from "zod";
import { answerSchema } from "#lib/decide/types";
import {
    componentCatalog,
    iconNames,
    inputComponentTypes,
    type PropSpec
} from "#lib/runtime/catalog";

/* -------------------------------------------------------------------------- */
/* Shared primitives                                                          */
/* -------------------------------------------------------------------------- */

export const APP_SCHEMA = "jevil/app@1";

const idPattern = /^[a-z][a-z0-9_]{0,31}$/;
const uiIdPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const tagPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const colorPattern = /^(?:#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|hsl\([^)]{1,40}\))$/;
const inputColorPattern = /^#[0-9a-fA-F]{6}$/;

export const appIdSchema = z.string().regex(idPattern, "Use lowercase letters, digits, and _");
export const varNameSchema = z
    .string()
    .regex(
        /^[a-z][a-zA-Z0-9_]{0,31}$/,
        "Start with a lowercase letter, then use letters, digits, or _"
    );
export const uiIdSchema = z.string().regex(uiIdPattern, "Use lowercase letters, digits, _ or -");
export const colorSchema = z.string().regex(colorPattern, "Use #rgb, #rrggbb, or hsl(...)");

const mediaSchema = z.enum(["text", "image", "audio", "video"]);
const providerSchema = z.enum(["jev", "laya", "clef", "cloudflare", "systemone"]);

const litSchema = z.union([
    z.string().max(4000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.unknown()).max(24),
    z.record(z.string(), z.unknown())
]);

const templateBindingSchema = z.strictObject({
    template: z.string().min(1).max(2000)
});

export const bindingSchema = z.union([
    z.strictObject({ lit: litSchema }),
    z.strictObject({ var: z.string().min(1).max(200) }),
    z.strictObject({
        step: appIdSchema,
        question: appIdSchema,
        pick: z
            .enum(["value", "choice", "score", "noul", "confidence", "probabilities", "answer"])
            .optional()
    }),
    templateBindingSchema
]);

export type Binding = z.infer<typeof bindingSchema>;

export type PropValue =
    string | number | boolean | null | unknown[] | Record<string, unknown> | Binding;

const propValueSchema: z.ZodType<PropValue> = z.union([
    z.string().max(4000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.unknown()).max(24),
    z.record(z.string(), z.unknown()),
    bindingSchema
]);

/* -------------------------------------------------------------------------- */
/* Meta                                                                       */
/* -------------------------------------------------------------------------- */

export const metaSchema = z.strictObject({
    title: z.string().min(2).max(48),
    tagline: z.string().min(8).max(120),
    description: z.string().max(2000).optional(),
    tags: z.array(z.string().regex(tagPattern).max(24)).min(1).max(5),
    accent: z.enum(["blue", "pink", "lime", "tangerine", "violet", "sky"]),
    icon: z.string().min(1).max(40),
    engine: z.strictObject({
        media: z.array(mediaSchema).min(1).max(4),
        recommended: z.array(providerSchema).max(5).optional()
    }),
    autorun: z.boolean().optional()
});

export type AppMeta = z.infer<typeof metaSchema>;

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export const inputTypeSchema = z.enum(["text", "textarea", "select", "slider", "toggle", "color"]);

export const inputSchema = z.strictObject({
    id: appIdSchema,
    type: inputTypeSchema,
    label: z.string().min(1).max(80),
    help: z.string().max(160).optional(),
    placeholder: z.string().max(200).optional(),
    default: z.union([z.string().max(4000), z.number(), z.boolean()]).optional(),
    required: z.boolean().optional(),
    maxLength: z.number().int().min(1).max(4000).optional(),
    options: z
        .array(
            z.strictObject({
                value: z.string().min(1).max(80),
                label: z.string().min(1).max(80)
            })
        )
        .min(1)
        .max(24)
        .optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional()
});

export type AppInput = z.infer<typeof inputSchema>;

/* -------------------------------------------------------------------------- */
/* Questions and steps                                                        */
/* -------------------------------------------------------------------------- */

const instructionsSchema = z.string().min(1).max(240);
const questionKeySchema = z.string().regex(idPattern, "Use lowercase letters, digits, and _");

export const questionSchema = z.discriminatedUnion("type", [
    z.strictObject({
        type: z.literal("choice"),
        instructions: instructionsSchema,
        criteria: z
            .record(questionKeySchema, z.string().min(1).max(160))
            .refine(
                (criteria) =>
                    Object.keys(criteria).length >= 2 && Object.keys(criteria).length <= 24,
                "A choice question needs 2–24 options"
            )
    }),
    z.strictObject({
        type: z.literal("score"),
        instructions: instructionsSchema,
        criteria: z.array(z.string().min(1).max(60)).min(2).max(10)
    }),
    z.strictObject({
        type: z.literal("noul"),
        instructions: instructionsSchema
    })
]);

export type AppQuestion = z.infer<typeof questionSchema>;

export const stepSchema = z.strictObject({
    id: appIdSchema,
    kind: z.literal("decide"),
    label: z.string().min(1).max(60).optional(),
    state: bindingSchema,
    questions: z
        .record(questionKeySchema, questionSchema)
        .refine(
            (questions) =>
                Object.keys(questions).length >= 1 && Object.keys(questions).length <= 20,
            "A step needs 1–20 questions"
        ),
    model: z.string().trim().min(1).max(120).optional(),
    when: bindingSchema.optional()
});

export type DecideStep = z.infer<typeof stepSchema>;

/* -------------------------------------------------------------------------- */
/* Vars                                                                       */
/* -------------------------------------------------------------------------- */

export const varTypeSchema = z.enum([
    "string",
    "number",
    "boolean",
    "color",
    "color[]",
    "string[]",
    "number[]",
    "json"
]);

export const transformSchema = z.discriminatedUnion("op", [
    z.strictObject({
        op: z.literal("lerp"),
        in: z.tuple([z.number(), z.number()]),
        out: z.tuple([z.number(), z.number()]),
        clamp: z.boolean().optional()
    }),
    z.strictObject({ op: z.literal("clamp"), min: z.number(), max: z.number() }),
    z.strictObject({ op: z.literal("round"), to: z.number().int().min(0).max(4).optional() }),
    z.strictObject({
        op: z.literal("lookup"),
        map: z
            .record(z.string(), z.unknown())
            .refine((map) => Object.keys(map).length > 0, "A lookup map cannot be empty"),
        default: z.unknown().optional()
    }),
    z.strictObject({
        op: z.literal("mapRange"),
        in: z.tuple([z.number(), z.number()]),
        out: z.tuple([z.number(), z.number()]),
        clamp: z.boolean().optional()
    }),
    z.strictObject({ op: z.literal("default"), value: z.unknown() }),
    z.strictObject({
        op: z.literal("concat"),
        prefix: z.string().max(200).optional(),
        suffix: z.string().max(200).optional(),
        separator: z.string().max(20).optional(),
        values: z.array(bindingSchema).max(20).optional()
    }),
    z.strictObject({
        op: z.literal("percent"),
        decimals: z.number().int().min(0).max(4).optional()
    }),
    z.strictObject({ op: z.literal("abs") }),
    z.strictObject({ op: z.literal("min"), value: z.number() }),
    z.strictObject({ op: z.literal("max"), value: z.number() })
]);

export type Transform = z.infer<typeof transformSchema>;

export const builtinSchema = z.enum([
    "hsl",
    "mix",
    "shade",
    "contrastText",
    "palette",
    "formatNumber",
    "pick",
    "first"
]);

export type BuiltinName = z.infer<typeof builtinSchema>;

export const varSchema = z
    .strictObject({
        type: varTypeSchema,
        from: bindingSchema.optional(),
        transform: z.array(transformSchema).max(20).optional(),
        fn: builtinSchema.optional(),
        args: z
            .record(
                z.string().regex(/^[a-z][a-zA-Z0-9]*$/, "Use a camelCase argument name"),
                z.union([bindingSchema, z.string().max(200), z.number(), z.boolean()])
            )
            .optional(),
        fallback: z.unknown().optional()
    })
    .refine((definition) => (definition.from === undefined) !== (definition.fn === undefined), {
        message: "Use exactly one of `from` or `fn`"
    })
    .refine((definition) => definition.transform === undefined || definition.from !== undefined, {
        message: "`transform` needs a `from` source"
    })
    .refine((definition) => definition.args === undefined || definition.fn !== undefined, {
        message: "`args` needs a builtin `fn`"
    });

export type VarDef = z.infer<typeof varSchema>;

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

export const actionSchema = z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("run") }),
    z.strictObject({ kind: z.literal("reset") }),
    z.strictObject({ kind: z.literal("set"), var: appIdSchema, value: bindingSchema }),
    z.strictObject({
        kind: z.literal("copy"),
        value: bindingSchema,
        label: z.string().max(60).optional()
    }),
    z.strictObject({ kind: z.literal("open"), url: bindingSchema }),
    z.strictObject({ kind: z.literal("none") })
]);

export type ActionDef = z.infer<typeof actionSchema>;

/* -------------------------------------------------------------------------- */
/* UI                                                                         */
/* -------------------------------------------------------------------------- */

export interface UiNode {
    type: string;
    id: string;
    props?: Record<string, PropValue>;
    children?: UiNode[];
    visible?: Binding;
}

const nodeSchema: z.ZodType<UiNode> = z.lazy(() =>
    z.strictObject({
        type: z.string().min(1).max(40),
        id: uiIdSchema,
        props: z.record(z.string().min(1).max(40), propValueSchema).optional(),
        children: z.array(nodeSchema).max(200).optional(),
        visible: bindingSchema.optional()
    })
);

/* -------------------------------------------------------------------------- */
/* Preview and the document                                                   */
/* -------------------------------------------------------------------------- */

export const previewSchema = z.strictObject({
    inputs: z.record(appIdSchema, z.union([z.string().max(4000), z.number(), z.boolean()])),
    answers: z.record(appIdSchema, z.record(appIdSchema, answerSchema)).optional()
});

export type Preview = z.infer<typeof previewSchema>;

export const blueprintSchema = z.strictObject({
    schema: z.literal(APP_SCHEMA),
    meta: metaSchema,
    preview: previewSchema.optional(),
    inputs: z.array(inputSchema).max(8),
    steps: z.array(stepSchema).max(10),
    vars: z.record(varNameSchema, varSchema),
    ui: nodeSchema,
    actions: z.record(appIdSchema, actionSchema).optional()
});

export type Blueprint = z.infer<typeof blueprintSchema>;

/* -------------------------------------------------------------------------- */
/* Issues and pointers                                                        */
/* -------------------------------------------------------------------------- */

export interface BlueprintIssue {
    /** JSON pointer, e.g. `/ui/children/2/props/colors`. */
    pointer: string;
    message: string;
}

export type BlueprintValidation =
    { ok: true; blueprint: Blueprint } | { ok: false; issues: BlueprintIssue[] };

const escapePointer = (segment: string): string =>
    segment.replaceAll("~", "~0").replaceAll("/", "~1");

const pointerOf = (base: string, segment: string | number): string =>
    `${base}/${escapePointer(String(segment))}`;

export const formatIssues = (issues: BlueprintIssue[]): string =>
    issues.map((issue) => `${issue.pointer || "/"}: ${issue.message}`).join("\n");

/* -------------------------------------------------------------------------- */
/* Semantic context                                                           */
/* -------------------------------------------------------------------------- */

type ValueType = "string" | "number" | "boolean" | "array" | "object" | "null" | "unknown";

interface Scope {
    inputs: Map<string, AppInput>;
    steps: Map<string, DecideStep>;
    vars: Map<string, VarDef>;
    actions: Map<string, ActionDef>;
    meta: AppMeta;
}

const valueTypeOfInput = (input: AppInput): ValueType => {
    if (input.type === "slider") return "number";
    if (input.type === "toggle") return "boolean";
    return "string";
};

const valueTypeOfVar = (type: VarDef["type"]): ValueType => {
    switch (type) {
        case "number":
            return "number";
        case "boolean":
            return "boolean";
        case "color[]":
        case "string[]":
        case "number[]":
            return "array";
        case "json":
            return "unknown";
        default:
            return "string";
    }
};

const varTypesMatch = (varType: VarDef["type"], value: ValueType | "color"): boolean => {
    if (varType === "json") return true;
    if (varType === "color" || varType === "string") return value === "string";
    if (varType === "color[]" || varType === "string[]" || varType === "number[]") {
        return value === "array";
    }
    return varType === value;
};

const literalType = (value: unknown): ValueType => {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    switch (typeof value) {
        case "string":
            return "string";
        case "number":
            return "number";
        case "boolean":
            return "boolean";
        case "object":
            return "object";
        default:
            return "unknown";
    }
};

const primaryType = (question: AppQuestion): ValueType =>
    question.type === "choice" ? "string" : "number";

/** The value type a binding produces, when it can be known statically. */
const pathType = (path: string, scope: Scope): ValueType => {
    const parts = path.split(".");
    if (parts[0] === "inputs" && parts.length === 2) {
        const input = scope.inputs.get(parts[1]!);
        return input ? valueTypeOfInput(input) : "unknown";
    }
    if (parts[0] === "vars" && parts.length === 2) {
        const definition = scope.vars.get(parts[1]!);
        return definition ? valueTypeOfVar(definition.type) : "unknown";
    }
    if (parts[0] === "meta" && parts.length === 2) return metaType(parts[1]!);
    if (parts[0] === "steps" && parts.length === 4) {
        const step = scope.steps.get(parts[1]!);
        const question = step?.questions[parts[2]!];
        if (!question) return "unknown";
        return questionFieldType(question, parts[3]!);
    }
    return "unknown";
};

const metaType = (field: string): ValueType =>
    field === "autorun"
        ? "boolean"
        : field === "title" ||
            field === "tagline" ||
            field === "description" ||
            field === "accent" ||
            field === "icon"
          ? "string"
          : "unknown";

const questionFieldType = (question: AppQuestion, field: string): ValueType => {
    if (field === "answer") return "object";
    if (field === "probabilities") return "object";
    if (field === "confidence") return question.type === "noul" ? "unknown" : "number";
    if (field === "choice") return question.type === "choice" ? "string" : "unknown";
    if (field === "score") return question.type === "score" ? "number" : "unknown";
    if (field === "noul") return question.type === "noul" ? "number" : "unknown";
    if (field === "value") return primaryType(question);
    return "unknown";
};

/* -------------------------------------------------------------------------- */
/* Validator                                                                  */
/* -------------------------------------------------------------------------- */

type BindingMode = "any" | "state" | "condition" | "visible";

interface CheckContext {
    scope: Scope;
    issues: BlueprintIssue[];
    reportedVarCycles: Set<string>;
}

const issue = (context: CheckContext, pointer: string, message: string): void => {
    context.issues.push({ pointer, message });
};

const checkPath = (
    path: string,
    pointer: string,
    context: CheckContext,
    mode: "var" | "template"
): ValueType => {
    const { scope } = context;
    const parts = path.split(".");

    const fail = (message: string): ValueType => {
        issue(context, pointer, message);
        return "unknown";
    };

    if (parts.some((part) => part.length === 0)) {
        return fail("Paths cannot contain an empty segment");
    }

    // `{ var: "hue" }` names a declared var directly (APP-FORMAT §7); the
    // dotted `vars.hue` form is also accepted for symmetry with templates.
    if (mode === "var" && parts.length === 1) {
        if (!scope.vars.has(path)) return fail(`Unknown var \`${path}\``);
        return pathType(`vars.${path}`, scope);
    }

    if (parts[0] === "inputs") {
        if (parts.length !== 2) return fail("An input path is `inputs.<id>`");
        if (!scope.inputs.has(parts[1]!)) return fail(`Unknown input \`${parts[1]}\``);
        return pathType(path, scope);
    }

    if (parts[0] === "vars") {
        if (parts.length !== 2) return fail("A var path is `vars.<id>`");
        if (!scope.vars.has(parts[1]!)) return fail(`Unknown var \`${parts[1]}\``);
        return pathType(path, scope);
    }

    if (parts[0] === "meta") {
        if (parts.length !== 2) return fail("A meta path is `meta.<field>`");
        const allowed = ["title", "tagline", "description", "accent", "icon", "autorun"];
        if (!allowed.includes(parts[1]!)) {
            return fail(`\`meta.${parts[1]}\` is not readable in a binding`);
        }
        return metaType(parts[1]!);
    }

    if (parts[0] === "steps") {
        if (mode === "var") {
            return fail("A var path cannot read answers; use a step binding");
        }
        if (parts.length !== 3 && parts.length !== 4) {
            return fail("An answer path is `steps.<step>.<question>[.<field>]`");
        }
        const step = scope.steps.get(parts[1]!);
        if (!step) return fail(`Unknown step \`${parts[1]}\``);
        const question = step.questions[parts[2]!];
        if (!question) return fail(`Unknown question \`${parts[2]}\``);
        const field = parts[3] ?? "value";
        const allowed = [
            "value",
            "choice",
            "score",
            "noul",
            "confidence",
            "probabilities",
            "answer"
        ];
        if (!allowed.includes(field)) {
            return fail(`\`${field}\` is not an answer field`);
        }
        if (questionFieldType(question, field) === "unknown") {
            return fail(`\`${question.type}\` answers have no \`${field}\` field`);
        }
        return questionFieldType(question, field);
    }

    return fail(
        mode === "template"
            ? "Template paths start with inputs, steps, vars, or meta"
            : "A var path starts with inputs, vars, or meta"
    );
};

const templatePaths = (template: string, pointer: string, context: CheckContext): void => {
    let cleaned = template.replaceAll("\\{{", "\u0000");

    cleaned = cleaned.replace(/\{\{([^{}]*)\}\}/g, (match, rawPath: string) => {
        const path = rawPath.trim();
        if (!path) {
            issue(context, pointer, "An empty {{ }} is not a path");
        } else {
            checkPath(path, pointer, context, "template");
        }
        return " ".repeat(match.length);
    });

    // A literal `\{{` leaves a harmless `}}` behind, so only an unmatched
    // opening counts as unclosed.
    if (cleaned.includes("{{")) {
        issue(context, pointer, "Unclosed template braces");
    }
};

const checkPick = (
    question: AppQuestion,
    pick: NonNullable<Extract<Binding, { step: string }>["pick"]>,
    pointer: string,
    context: CheckContext
): void => {
    const allowed: Record<AppQuestion["type"], string[]> = {
        choice: ["value", "choice", "confidence", "probabilities", "answer"],
        score: ["value", "score", "confidence", "probabilities", "answer"],
        noul: ["value", "noul", "answer"]
    };

    if (!allowed[question.type].includes(pick)) {
        issue(context, pointer, `\`${question.type}\` answers have no \`${pick}\` field`);
    }
};

const checkBinding = (
    binding: Binding,
    pointer: string,
    context: CheckContext,
    mode: BindingMode = "any"
): ValueType => {
    let type: ValueType;

    if ("lit" in binding) {
        type = literalType(binding.lit);

        if (mode === "state") {
            if (type === "number" || type === "boolean" || type === "null") {
                issue(context, pointer, "State must resolve to a string, object, or array");
            } else if (JSON.stringify(binding.lit).length > 8000) {
                issue(context, pointer, "State is limited to 8,000 characters");
            }
        }

        if (mode === "condition" && type !== "boolean") {
            issue(context, pointer, "`when` must resolve to a boolean");
        }

        if (mode === "visible" && !["boolean", "number", "string", "null"].includes(type)) {
            issue(context, pointer, "`visible` must resolve to a boolean or a number");
        }

        return type;
    }

    if ("template" in binding) {
        templatePaths(binding.template, pointer, context);
        type = "string";
    } else if ("var" in binding) {
        type = checkPath(binding.var, pointer, context, "var");
    } else {
        const step = context.scope.steps.get(binding.step);
        if (!step) {
            issue(context, pointer, `Unknown step \`${binding.step}\``);
            return "unknown";
        }

        const question = step.questions[binding.question];
        if (!question) {
            issue(context, pointer, `Unknown question \`${binding.question}\``);
            return "unknown";
        }

        const pick = binding.pick ?? "value";
        checkPick(question, pick, pointer, context);
        type =
            pick === "probabilities"
                ? "object"
                : pick === "answer"
                  ? "object"
                  : pick === "choice"
                    ? "string"
                    : pick === "confidence" || pick === "score" || pick === "noul"
                      ? "number"
                      : primaryType(question);
    }

    if (mode === "state" && (type === "number" || type === "boolean" || type === "null")) {
        issue(context, pointer, "State must resolve to a string, object, or array");
    }

    if (mode === "condition" && type !== "boolean" && type !== "unknown") {
        issue(context, pointer, "`when` must resolve to a boolean");
    }

    if (mode === "visible" && !["boolean", "number", "string", "null", "unknown"].includes(type)) {
        issue(context, pointer, "`visible` must resolve to a boolean or a number");
    }

    return type;
};

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

const checkDefault = (input: AppInput, pointer: string, context: CheckContext): void => {
    if (input.default === undefined) return;

    const value = input.default;
    const wrong = (expected: string) =>
        issue(context, pointer, `Default must be ${expected} for a ${input.type} input`);

    if (input.type === "toggle") {
        if (typeof value !== "boolean") wrong("a boolean");
        return;
    }

    if (input.type === "slider") {
        if (typeof value !== "number") {
            wrong("a number");
            return;
        }
        if (input.min !== undefined && value < input.min) wrong("at least min");
        if (input.max !== undefined && value > input.max) wrong("at most max");
        return;
    }

    if (typeof value !== "string") {
        wrong("a string");
        return;
    }

    if (input.type === "color" && !inputColorPattern.test(value)) {
        wrong("a #rrggbb color");
    }

    if (
        input.type === "select" &&
        input.options &&
        !input.options.some((option) => option.value === value)
    ) {
        issue(context, pointer, "Default must match one of the select options");
    }
};

const checkInput = (input: AppInput, pointer: string, context: CheckContext): void => {
    if (input.type === "text" || input.type === "textarea") {
        const max = input.type === "text" ? 500 : 4000;
        if (input.maxLength !== undefined && input.maxLength > max) {
            issue(context, pointerOf(pointer, "maxLength"), `Limit is ${max} for ${input.type}`);
        }
        for (const field of ["options", "min", "max", "step"] as const) {
            if (input[field] !== undefined) {
                issue(context, pointerOf(pointer, field), `${field} is not used by ${input.type}`);
            }
        }
    }

    if (input.type === "select") {
        if (!input.options || input.options.length === 0) {
            issue(context, pointerOf(pointer, "options"), "A select needs options");
        }
        for (const field of ["min", "max", "step", "maxLength"] as const) {
            if (input[field] !== undefined) {
                issue(context, pointerOf(pointer, field), `${field} is not used by select`);
            }
        }
        const values = new Set<string>();
        input.options?.forEach((option, index) => {
            if (values.has(option.value)) {
                issue(
                    context,
                    pointerOf(pointerOf(pointer, "options"), index),
                    `Duplicate option value \`${option.value}\``
                );
            }
            values.add(option.value);
        });
    }

    if (input.type === "slider") {
        for (const field of ["options", "maxLength", "placeholder"] as const) {
            if (input[field] !== undefined) {
                issue(context, pointerOf(pointer, field), `${field} is not used by slider`);
            }
        }
        if (input.min === undefined || input.max === undefined) {
            issue(context, pointer, "A slider needs min and max");
        } else if (input.min >= input.max) {
            issue(context, pointer, "A slider needs min < max");
        }
    } else {
        for (const field of ["min", "max", "step"] as const) {
            if (input[field] !== undefined) {
                issue(context, pointerOf(pointer, field), `${field} is only for sliders`);
            }
        }
    }

    if (input.type === "toggle" || input.type === "color") {
        if (input.options !== undefined) {
            issue(context, pointerOf(pointer, "options"), "options is only for selects");
        }
        if (input.maxLength !== undefined) {
            issue(context, pointerOf(pointer, "maxLength"), "maxLength is only for text");
        }
        if (input.placeholder !== undefined) {
            issue(context, pointerOf(pointer, "placeholder"), "placeholder is only for text");
        }
    }

    checkDefault(input, pointerOf(pointer, "default"), context);
};

/* -------------------------------------------------------------------------- */
/* Builtins and vars                                                          */
/* -------------------------------------------------------------------------- */

type ArgType = "number" | "string" | "boolean" | "color" | "array" | "seed" | "harmony";

const harmonyValues = [
    "analogous",
    "complementary",
    "triadic",
    "split",
    "monochrome",
    "tetradic"
] as const;

const builtins: Record<
    BuiltinName,
    { required: Record<string, ArgType>; optional: Record<string, ArgType>; returns: ValueType }
> = {
    hsl: {
        required: { h: "number", s: "number", l: "number" },
        optional: {},
        returns: "string"
    },
    mix: {
        required: { a: "color", b: "color", t: "number" },
        optional: {},
        returns: "string"
    },
    shade: {
        required: { color: "color", amount: "number" },
        optional: {},
        returns: "string"
    },
    contrastText: { required: { color: "color" }, optional: {}, returns: "string" },
    palette: {
        required: { hue: "number", saturation: "number", lightness: "number", harmony: "harmony" },
        optional: { count: "number", seed: "seed" },
        returns: "array"
    },
    formatNumber: {
        required: { value: "number" },
        optional: { decimals: "number" },
        returns: "string"
    },
    pick: { required: { list: "array" }, optional: { seed: "seed" }, returns: "unknown" },
    first: { required: { list: "array" }, optional: {}, returns: "unknown" }
};

const argMatches = (value: unknown, type: ArgType): boolean => {
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    if (type === "string") return typeof value === "string";
    if (type === "boolean") return typeof value === "boolean";
    if (type === "color") return typeof value === "string" && colorPattern.test(value);
    if (type === "array") return Array.isArray(value);
    if (type === "seed") return typeof value === "string" || typeof value === "number";
    return typeof value === "string" && (harmonyValues as readonly string[]).includes(value);
};

const argAccepts = (type: ArgType, value: ValueType): boolean => {
    if (type === "color" || type === "harmony") return value === "string";
    if (type === "array") return value === "array";
    if (type === "seed") return value === "string" || value === "number";
    return value === type;
};

const transformOutputType = (
    input: ValueType,
    transform: Transform,
    pointer: string,
    context: CheckContext
): ValueType => {
    const needsNumber = (): void => {
        if (input !== "number" && input !== "unknown") {
            issue(context, pointer, "This transform needs a number");
        }
    };

    switch (transform.op) {
        case "lerp":
        case "mapRange":
        case "clamp":
        case "round":
        case "abs":
        case "min":
        case "max":
            needsNumber();
            return "number";
        case "percent":
            needsNumber();
            return "string";
        case "concat":
            return "string";
        case "default":
            return input === "null" || input === "unknown" ? literalType(transform.value) : input;
        case "lookup": {
            if (input !== "string" && input !== "number" && input !== "unknown") {
                issue(context, pointer, "A lookup source must be a string or number");
            }
            const types = new Set(Object.values(transform.map).map(literalType));
            return types.size === 1 ? [...types][0]! : "unknown";
        }
    }
};

const checkVar = (
    name: string,
    definition: VarDef,
    pointer: string,
    context: CheckContext
): void => {
    let current: ValueType = "unknown";

    if (definition.from) {
        current = checkBinding(definition.from, pointerOf(pointer, "from"), context);
    }

    definition.transform?.forEach((transform, index) => {
        const transformPointer = pointerOf(pointerOf(pointer, "transform"), index);

        if (transform.op === "lerp" || transform.op === "mapRange") {
            if (transform.in[0] === transform.in[1]) {
                issue(context, pointerOf(transformPointer, "in"), "Input range cannot be empty");
            }
        }

        if (transform.op === "lookup" && Object.keys(transform.map).length === 0) {
            issue(context, pointerOf(transformPointer, "map"), "A lookup map cannot be empty");
        }

        if (transform.op === "concat") {
            transform.values?.forEach((value, valueIndex) => {
                checkBinding(
                    value,
                    pointerOf(pointerOf(transformPointer, "values"), valueIndex),
                    context
                );
            });
        }

        current = transformOutputType(current, transform, transformPointer, context);
    });

    if (
        definition.from &&
        definition.type !== "json" &&
        current !== "unknown" &&
        !varTypesMatch(definition.type, current)
    ) {
        issue(
            context,
            pointerOf(pointer, "type"),
            `This var produces ${current}, not ${definition.type}`
        );
    }

    if (definition.fn) {
        const builtin = builtins[definition.fn];
        const args = definition.args ?? {};
        const argsPointer = pointerOf(pointer, "args");

        for (const [key, type] of Object.entries(builtin.required)) {
            if (!(key in args)) {
                issue(context, pointerOf(argsPointer, key), `\`${key}\` is required`);
                continue;
            }
            checkArg(args[key], type, pointerOf(argsPointer, key), context);
        }

        for (const [key, type] of Object.entries(builtin.optional)) {
            if (key in args) checkArg(args[key], type, pointerOf(argsPointer, key), context);
        }

        for (const key of Object.keys(args)) {
            if (!(key in builtin.required) && !(key in builtin.optional)) {
                issue(
                    context,
                    pointerOf(argsPointer, key),
                    `Unknown \`${definition.fn}\` argument`
                );
            }
        }

        if (
            definition.type !== "json" &&
            builtin.returns !== "unknown" &&
            !varTypesMatch(definition.type, builtin.returns)
        ) {
            issue(
                context,
                pointerOf(pointer, "type"),
                `\`${definition.fn}\` returns ${builtin.returns}, not ${definition.type}`
            );
        }
    }

    if (definition.fallback !== undefined && definition.type !== "json") {
        const fallbackType = literalType(definition.fallback);
        if (!varTypesMatch(definition.type, fallbackType)) {
            issue(
                context,
                pointerOf(pointer, "fallback"),
                `Fallback must match ${definition.type}`
            );
        }
    }

    void name;
};

const checkArg = (
    value: unknown,
    expected: ArgType,
    pointer: string,
    context: CheckContext
): void => {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const candidate = value as Record<string, unknown>;
        if (
            "lit" in candidate ||
            "var" in candidate ||
            "step" in candidate ||
            "template" in candidate
        ) {
            const parsed = bindingSchema.safeParse(value);
            if (!parsed.success) {
                issue(context, pointer, "That binding is not valid");
                return;
            }
            const resolved = checkBinding(parsed.data, pointer, context);
            if (resolved !== "unknown" && !argAccepts(expected, resolved)) {
                issue(context, pointer, `Expected ${expected}`);
            }
            return;
        }
    }

    if (!argMatches(value, expected)) {
        issue(context, pointer, `Expected ${expected}`);
    }
};

const varDependencies = (definition: VarDef): string[] => {
    const dependencies: string[] = [];

    const collect = (binding: Binding): void => {
        if ("var" in binding) {
            const [root, id] = binding.var.split(".");
            if (id && root === "vars") dependencies.push(id);
            if (!id && root) dependencies.push(root);
        }
        if ("template" in binding) {
            for (const match of binding.template.matchAll(/\{\{([^{}]*)\}\}/g)) {
                const [root, id] = match[1]!.trim().split(".");
                if (root === "vars" && id) dependencies.push(id);
            }
        }
    };

    if (definition.from) collect(definition.from);
    definition.transform?.forEach((transform) => {
        if (transform.op === "concat") transform.values?.forEach(collect);
    });
    for (const value of Object.values(definition.args ?? {})) {
        const parsed = bindingSchema.safeParse(value);
        if (parsed.success) collect(parsed.data);
    }

    return [...new Set(dependencies)];
};

const checkVarCycles = (context: CheckContext, vars: Record<string, VarDef>): void => {
    const visiting = new Set<string>();
    const done = new Set<string>();

    const visit = (name: string, stack: string[]): void => {
        if (done.has(name)) return;
        if (visiting.has(name)) {
            const cycle = [...stack.slice(stack.indexOf(name)), name].join(" → ");
            if (!context.reportedVarCycles.has(cycle)) {
                context.reportedVarCycles.add(cycle);
                issue(context, pointerOf("/vars", name), `Var cycle: ${cycle}`);
            }
            return;
        }

        visiting.add(name);
        for (const dependency of varDependencies(vars[name]!)) {
            if (dependency in vars) visit(dependency, [...stack, name]);
        }
        visiting.delete(name);
        done.add(name);
    };

    for (const name of Object.keys(vars)) visit(name, []);
};

/* -------------------------------------------------------------------------- */
/* Actions and UI                                                             */
/* -------------------------------------------------------------------------- */

const isActionRef = (value: unknown): value is { ref: string } =>
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as Record<string, unknown>).ref === "string";

const checkAction = (action: ActionDef, pointer: string, context: CheckContext): void => {
    if (action.kind === "set") {
        if (!context.scope.inputs.has(action.var)) {
            issue(context, pointerOf(pointer, "var"), `Unknown input \`${action.var}\``);
        }
        checkBinding(action.value, pointerOf(pointer, "value"), context);
    }

    if (action.kind === "copy") {
        checkBinding(action.value, pointerOf(pointer, "value"), context);
    }

    if (action.kind === "open") {
        checkBinding(action.url, pointerOf(pointer, "url"), context);
        if ("lit" in action.url && typeof action.url.lit === "string") {
            if (!action.url.lit.startsWith("https://")) {
                issue(context, pointerOf(pointer, "url"), "Open URLs must start with https://");
            }
        }
    }
};

const checkActionProp = (value: PropValue, pointer: string, context: CheckContext): void => {
    if (isActionRef(value)) {
        if (!context.scope.actions.has(value.ref)) {
            issue(context, pointer, `Unknown action \`${value.ref}\``);
        }
        return;
    }

    const parsed = actionSchema.safeParse(value);
    if (!parsed.success) {
        issue(context, pointer, "That action is not valid");
        return;
    }

    checkAction(parsed.data, pointer, context);
};

const checkPropLiteral = (
    value: unknown,
    spec: PropSpec,
    pointer: string,
    context: CheckContext
): void => {
    switch (spec.type) {
        case "any":
            return;
        case "string":
            if (typeof value !== "string") issue(context, pointer, "Expected a string");
            else if (spec.maxLength !== undefined && value.length > spec.maxLength) {
                issue(context, pointer, `Longer than ${spec.maxLength} characters`);
            }
            return;
        case "number":
            if (typeof value !== "number" || !Number.isFinite(value)) {
                issue(context, pointer, "Expected a number");
                return;
            }
            if (spec.min !== undefined && value < spec.min)
                issue(context, pointer, `Below ${spec.min}`);
            if (spec.max !== undefined && value > spec.max)
                issue(context, pointer, `Above ${spec.max}`);
            return;
        case "integer":
            if (typeof value !== "number" || !Number.isInteger(value)) {
                issue(context, pointer, "Expected an integer");
                return;
            }
            if (spec.min !== undefined && value < spec.min)
                issue(context, pointer, `Below ${spec.min}`);
            if (spec.max !== undefined && value > spec.max)
                issue(context, pointer, `Above ${spec.max}`);
            return;
        case "boolean":
            if (typeof value !== "boolean") issue(context, pointer, "Expected a boolean");
            return;
        case "color":
            if (typeof value !== "string" || !colorPattern.test(value)) {
                issue(context, pointer, "Expected a color");
            }
            return;
        case "colors":
            if (!Array.isArray(value) || value.length < 2 || value.length > 12) {
                issue(context, pointer, "Expected 2–12 colors");
                return;
            }
            value.forEach((color, index) => {
                if (typeof color !== "string" || !colorPattern.test(color)) {
                    issue(context, pointerOf(pointer, index), "Expected a color");
                }
            });
            return;
        case "strings":
            if (!Array.isArray(value)) {
                issue(context, pointer, "Expected a list of strings");
                return;
            }
            if (spec.itemMax !== undefined && value.length > spec.itemMax) {
                issue(context, pointer, `At most ${spec.itemMax} items`);
            }
            value.forEach((item, index) => {
                if (typeof item !== "string") {
                    issue(context, pointerOf(pointer, index), "Expected a string");
                } else if (spec.maxLength !== undefined && item.length > spec.maxLength) {
                    issue(context, pointerOf(pointer, index), `Longer than ${spec.maxLength}`);
                }
            });
            return;
        case "record":
            if (typeof value !== "object" || value === null || Array.isArray(value)) {
                issue(context, pointer, "Expected a record");
                return;
            }
            for (const [key, entry] of Object.entries(value)) {
                if (typeof entry !== "number" || entry < 0 || entry > 1) {
                    issue(context, pointerOf(pointer, key), "Probability must be 0..1");
                }
            }
            return;
        case "enum":
            if (typeof value !== "string" || !spec.values?.includes(value)) {
                issue(context, pointer, `Expected one of ${spec.values?.join(", ")}`);
            }
            return;
        case "action":
            checkActionProp(value as PropValue, pointer, context);
    }
};

const checkInputRef = (
    name: string,
    component: string,
    pointer: string,
    context: CheckContext
): void => {
    const input = context.scope.inputs.get(name);
    if (!input) {
        issue(context, pointer, `Unknown input \`${name}\``);
        return;
    }

    const expected = inputComponentTypes[component];
    if (expected && input.type !== expected) {
        issue(context, pointer, `${component} needs a ${expected} input, not ${input.type}`);
    }
};

const checkNode = (
    node: UiNode,
    pointer: string,
    depth: number,
    context: CheckContext,
    nodeIds: Set<string>,
    nodeCount: { value: number }
): void => {
    nodeCount.value += 1;

    if (nodeCount.value > 200) {
        if (nodeCount.value === 201) issue(context, pointer, "A UI tree is limited to 200 nodes");
        return;
    }

    if (depth > 12) {
        issue(context, pointer, "UI depth is limited to 12");
        return;
    }

    if (nodeIds.has(node.id)) {
        issue(context, pointerOf(pointer, "id"), `Duplicate node id \`${node.id}\``);
    }
    nodeIds.add(node.id);

    const spec = componentCatalog[node.type];
    if (!spec) {
        issue(context, pointerOf(pointer, "type"), `Unknown component \`${node.type}\``);
        return;
    }

    if ((node.children?.length ?? 0) > 0 && !spec.container) {
        issue(context, pointerOf(pointer, "children"), `${node.type} cannot have children`);
    }

    const props = node.props ?? {};
    const propsPointer = pointerOf(pointer, "props");

    for (const required of spec.required) {
        if (!(required in props)) {
            issue(context, pointerOf(propsPointer, required), `${required} is required`);
        }
    }

    for (const [key, value] of Object.entries(props)) {
        const propSpec = spec.props[key];
        if (!propSpec) {
            issue(context, pointerOf(propsPointer, key), `Unknown prop \`${key}\``);
            continue;
        }

        const propPointer = pointerOf(propsPointer, key);
        const parsed = bindingSchema.safeParse(value);

        if (parsed.success) {
            const type = checkBinding(parsed.data, propPointer, context);
            if (propSpec.type === "action") {
                issue(context, propPointer, "action cannot be a binding");
            } else if (propSpec.inputRef) {
                if (type !== "string" && type !== "unknown") {
                    issue(context, propPointer, "input must name an input");
                } else if ("lit" in parsed.data && typeof parsed.data.lit === "string") {
                    checkInputRef(parsed.data.lit, node.type, propPointer, context);
                }
            } else if (propSpec.type === "color" && type !== "unknown" && type !== "string") {
                issue(context, propPointer, "Expected a color");
            } else if (propSpec.type === "colors" && type !== "unknown" && type !== "array") {
                issue(context, propPointer, "Expected a color list");
            } else if (propSpec.type === "record" && type !== "unknown" && type !== "object") {
                issue(context, propPointer, "Expected a record");
            } else if (propSpec.type === "strings" && type !== "unknown" && type !== "array") {
                issue(context, propPointer, "Expected a string list");
            } else if (propSpec.type === "number" || propSpec.type === "integer") {
                if (type !== "unknown" && type !== "number") {
                    issue(context, propPointer, "Expected a number");
                }
            } else if (propSpec.type === "boolean" && type !== "unknown" && type !== "boolean") {
                issue(context, propPointer, "Expected a boolean");
            } else if (propSpec.type === "string" && type !== "unknown" && type !== "string") {
                issue(context, propPointer, "Expected a string");
            }
            continue;
        }

        checkPropLiteral(value, propSpec, propPointer, context);

        if (propSpec.inputRef && typeof value === "string") {
            checkInputRef(value, node.type, propPointer, context);
        }
    }

    if (node.visible) {
        checkBinding(node.visible, pointerOf(pointer, "visible"), context, "visible");
    }

    node.children?.forEach((child, index) => {
        checkNode(
            child,
            pointerOf(pointerOf(pointer, "children"), index),
            depth + 1,
            context,
            nodeIds,
            nodeCount
        );
    });
};

/* -------------------------------------------------------------------------- */
/* Preview                                                                    */
/* -------------------------------------------------------------------------- */

const previewValueMatches = (input: AppInput, value: string | number | boolean): boolean => {
    if (input.type === "slider") return typeof value === "number";
    if (input.type === "toggle") return typeof value === "boolean";
    return typeof value === "string";
};

const checkPreview = (preview: Preview, pointer: string, context: CheckContext): void => {
    const { scope } = context;

    for (const [id, value] of Object.entries(preview.inputs)) {
        const input = scope.inputs.get(id);
        if (!input) {
            issue(context, pointerOf(pointerOf(pointer, "inputs"), id), `Unknown input \`${id}\``);
            continue;
        }
        if (!previewValueMatches(input, value)) {
            issue(
                context,
                pointerOf(pointerOf(pointer, "inputs"), id),
                `Expected a ${input.type === "slider" ? "number" : input.type === "toggle" ? "boolean" : "string"}`
            );
        }
    }

    for (const input of scope.inputs.values()) {
        if (
            input.required !== false &&
            input.default === undefined &&
            !(input.id in preview.inputs)
        ) {
            issue(
                context,
                pointerOf(pointerOf(pointer, "inputs"), input.id),
                `Required input \`${input.id}\` is missing`
            );
        }
    }

    for (const [stepId, answers] of Object.entries(preview.answers ?? {})) {
        const step = scope.steps.get(stepId);
        const stepPointer = pointerOf(pointerOf(pointer, "answers"), stepId);
        if (!step) {
            issue(context, stepPointer, `Unknown step \`${stepId}\``);
            continue;
        }

        for (const [questionId, answer] of Object.entries(answers)) {
            const question = step.questions[questionId];
            const answerPointer = pointerOf(stepPointer, questionId);
            if (!question) {
                issue(context, answerPointer, `Unknown question \`${questionId}\``);
                continue;
            }
            if (answer.type !== question.type) {
                issue(context, answerPointer, `Expected a ${question.type} answer`);
                continue;
            }
            if (
                question.type === "choice" &&
                answer.type === "choice" &&
                !(answer.choice in question.criteria)
            ) {
                issue(context, answerPointer, `\`${answer.choice}\` is not a criteria key`);
            }
        }
    }
};

/* -------------------------------------------------------------------------- */
/* Banned content                                                             */
/* -------------------------------------------------------------------------- */

const bannedPatterns: Array<{ pattern: RegExp; message: string }> = [
    { pattern: /<script/i, message: "Script tags are not allowed" },
    { pattern: /javascript:/i, message: "javascript: URLs are not allowed" },
    { pattern: /data:text\/html/i, message: "data:text/html URLs are not allowed" }
];

const scanStrings = (value: unknown, pointer: string, context: CheckContext): void => {
    if (typeof value === "string") {
        for (const { pattern, message } of bannedPatterns) {
            if (pattern.test(value)) issue(context, pointer, message);
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((entry, index) => scanStrings(entry, pointerOf(pointer, index), context));
        return;
    }

    if (typeof value === "object" && value !== null) {
        for (const [key, entry] of Object.entries(value)) {
            scanStrings(entry, pointerOf(pointer, key), context);
        }
    }
};

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

const zodIssues = (error: z.ZodError): BlueprintIssue[] => {
    const seen = new Set<string>();
    const issues: BlueprintIssue[] = [];

    for (const entry of error.issues) {
        const pointer = entry.path.reduce<string>(
            (base, segment) => pointerOf(base, String(segment)),
            ""
        );
        const key = `${pointer}:${entry.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({ pointer, message: entry.message });
    }

    return issues;
};

export const validateBlueprint = (input: unknown): BlueprintValidation => {
    const parsed = blueprintSchema.safeParse(input);
    if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };

    const blueprint = parsed.data;
    const context: CheckContext = {
        scope: {
            inputs: new Map(blueprint.inputs.map((item) => [item.id, item])),
            steps: new Map(blueprint.steps.map((item) => [item.id, item])),
            vars: new Map(Object.entries(blueprint.vars)),
            actions: new Map(Object.entries(blueprint.actions ?? {})),
            meta: blueprint.meta
        },
        issues: [],
        reportedVarCycles: new Set()
    };

    scanStrings(blueprint, "", context);

    if (!iconNames.includes(blueprint.meta.icon as (typeof iconNames)[number])) {
        if (Array.from(blueprint.meta.icon).length > 8) {
            issue(context, "/meta/icon", "Icon must be an emoji or an allowlisted icon name");
        }
    }

    if (blueprint.meta.engine.media.some((media) => media !== "text")) {
        issue(context, "/meta/engine/media", "v1 engines support text only");
    }

    blueprint.inputs.forEach((input, index) => {
        const pointer = pointerOf("/inputs", index);
        const duplicate = blueprint.inputs.findIndex((other) => other.id === input.id);
        if (duplicate !== index) {
            issue(context, pointerOf(pointer, "id"), `Duplicate input id \`${input.id}\``);
        }
        checkInput(input, pointer, context);
    });

    let totalQuestions = 0;
    blueprint.steps.forEach((step, index) => {
        const pointer = pointerOf("/steps", index);
        const duplicate = blueprint.steps.findIndex((other) => other.id === step.id);
        if (duplicate !== index) {
            issue(context, pointerOf(pointer, "id"), `Duplicate step id \`${step.id}\``);
        }

        totalQuestions += Object.keys(step.questions).length;
        checkBinding(step.state, pointerOf(pointer, "state"), context, "state");
        if (step.when) {
            checkBinding(step.when, pointerOf(pointer, "when"), context, "condition");
        }
    });

    if (totalQuestions > 40) {
        issue(context, "/steps", "An app is limited to 40 questions");
    }

    for (const [name, definition] of Object.entries(blueprint.vars)) {
        checkVar(name, definition, pointerOf("/vars", name), context);
    }
    checkVarCycles(context, blueprint.vars);

    for (const [name, action] of Object.entries(blueprint.actions ?? {})) {
        checkAction(action, pointerOf("/actions", name), context);
    }

    checkNode(blueprint.ui, "/ui", 0, context, new Set(), { value: 0 });

    if (blueprint.preview) {
        checkPreview(blueprint.preview, "/preview", context);
    }

    return context.issues.length === 0
        ? { ok: true, blueprint }
        : { ok: false, issues: context.issues };
};
