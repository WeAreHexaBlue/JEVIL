/**
 * Turn a validated blueprint + a runtime snapshot into resolved nodes.
 *
 * The Svelte renderer stays dumb: every binding is resolved here, every
 * default is applied from the shared catalog, and every action is reduced to
 * a plain instruction. This keeps the rules testable without a DOM and keeps
 * component markup free of evaluation logic.
 *
 * APP-FORMAT §8: unknown components render nothing with a warning, `visible`
 * follows its own coercion (numbers are true above 0.5, missing is true), and
 * text is only ever text.
 */

import type { ActionDef, Binding, Blueprint, UiNode } from "#lib/schema/blueprint";
import { componentCatalog } from "./catalog";
import { resolveBinding, textOf, type InputValue, type RuntimeScope } from "./bindings";
import type { RuntimeSnapshot } from "./runner";

export const MAX_RENDER_DEPTH = 12;

export type ResolvedAction =
    | { kind: "run" }
    | { kind: "reset" }
    | { kind: "none" }
    | { kind: "set"; input: string; value: unknown }
    | { kind: "copy"; text: string; label?: string }
    | { kind: "open"; url: string };

export interface ResolvedNode {
    id: string;
    type: string;
    props: Record<string, unknown>;
    action?: ResolvedAction;
    children: ResolvedNode[];
}

export interface RenderResult {
    root: ResolvedNode | null;
    /** Input ids placed in the body; the control panel hides duplicates. */
    usedInputs: string[];
    warnings: string[];
}

const isBinding = (value: unknown): value is Binding => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    return "lit" in value || "var" in value || "step" in value || "template" in value;
};

/**
 * `visible` coercion (APP-FORMAT §8):
 * booleans pass, numbers are true above 0.5, strings are true when non-empty,
 * and `null`/missing is true.
 */
export const visibleOf = (value: unknown): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0.5;
    if (typeof value === "string") return value.length > 0;
    return true;
};

/** Render text as text. Objects become compact JSON, never markup. */
export const textValue = (value: unknown): string => textOf(value);

const openAction = (
    raw: unknown,
    blueprint: Blueprint,
    scope: RuntimeScope
): ResolvedAction | undefined => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const action = raw as Record<string, unknown>;

    if (typeof action.ref === "string") {
        const definition = blueprint.actions?.[action.ref];
        return definition ? openAction(definition, blueprint, scope) : undefined;
    }

    const definition = raw as ActionDef;
    switch (definition.kind) {
        case "run":
            return { kind: "run" };
        case "reset":
            return { kind: "reset" };
        case "none":
            return { kind: "none" };
        case "set":
            return {
                kind: "set",
                input: definition.var,
                value: resolveBinding(definition.value, scope)
            };
        case "copy":
            return {
                kind: "copy",
                text: textValue(resolveBinding(definition.value, scope)),
                ...(definition.label ? { label: definition.label } : {})
            };
        case "open": {
            const url = textValue(resolveBinding(definition.url, scope));
            // Validation already requires https; keep the renderer honest too.
            return url.startsWith("https://") ? { kind: "open", url } : undefined;
        }
        default:
            return undefined;
    }
};

const resolveProps = (
    node: UiNode,
    spec: (typeof componentCatalog)[string],
    scope: RuntimeScope,
    warnings: string[]
): Record<string, unknown> => {
    const props: Record<string, unknown> = {};
    const declared = node.props ?? {};

    for (const [key, definition] of Object.entries(spec.props)) {
        if (key in declared) {
            const raw = declared[key];
            props[key] = isBinding(raw) ? resolveBinding(raw, scope) : raw;
        } else if (definition.default !== undefined) {
            props[key] = definition.default;
        }
    }

    for (const key of Object.keys(declared)) {
        if (!(key in spec.props)) warnings.push(`${node.type} has no \`${key}\` prop`);
    }

    return props;
};

const resolveNode = (
    node: UiNode,
    blueprint: Blueprint,
    scope: RuntimeScope,
    result: RenderResult,
    depth: number
): ResolvedNode | null => {
    if (depth > MAX_RENDER_DEPTH) {
        result.warnings.push(`${node.id} is nested too deeply`);
        return null;
    }

    const spec = componentCatalog[node.type];
    if (!spec) {
        result.warnings.push(`Unknown component \`${node.type}\``);
        return null;
    }

    if (node.visible) {
        const visible = resolveBinding(node.visible, scope);
        if (!visibleOf(visible)) return null;
    }

    const props = resolveProps(node, spec, scope, result.warnings);
    let action: ResolvedAction | undefined;

    if (spec.props.action && "action" in (node.props ?? {})) {
        action = openAction((node.props ?? {}).action, blueprint, scope);
        if (!action) result.warnings.push(`${node.id} has an unusable action`);
    }

    if (spec.props.input && typeof props.input === "string") {
        result.usedInputs.push(props.input);
    }

    if (node.children && !spec.container) {
        result.warnings.push(`${node.type} cannot have children`);
    }

    const children: ResolvedNode[] = [];
    if (spec.container) {
        for (const child of node.children ?? []) {
            const resolved = resolveNode(child, blueprint, scope, result, depth + 1);
            if (resolved) children.push(resolved);
        }
    }

    return {
        id: node.id,
        type: node.type,
        props,
        ...(action ? { action } : {}),
        children
    };
};

/** Resolve a whole tree with the current inputs. */
export const resolveTree = (
    blueprint: Blueprint,
    snapshot: RuntimeSnapshot,
    inputs: Record<string, InputValue> = {}
): RenderResult => {
    const scope: RuntimeScope = {
        inputs,
        answers: snapshot.answers,
        vars: snapshot.vars,
        meta: blueprint.meta,
        seed: snapshot.seed
    };
    const result: RenderResult = { root: null, usedInputs: [], warnings: [] };

    result.root = resolveNode(blueprint.ui, blueprint, scope, result, 0);
    result.usedInputs = [...new Set(result.usedInputs)];

    return result;
};
