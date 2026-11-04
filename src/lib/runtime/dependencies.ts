/**
 * Which other vars a definition reads (APP-FORMAT §10.2).
 *
 * The validator uses this to find cycles and the runtime uses it to evaluate in
 * dependency order. It is pure and type-only, so both layers share one answer
 * without pulling zod into the client bundle.
 */

import type { Binding, VarDef } from "#lib/schema/blueprint";

/** Var ids a single binding reads. `{ var: "hue" }` and `vars.hue` both count. */
export const bindingVarRefs = (binding: Binding): string[] => {
    if ("var" in binding) {
        const [root, id] = binding.var.split(".");
        return id && root === "vars" ? [id] : !id && root ? [root] : [];
    }

    if ("template" in binding) {
        const refs: string[] = [];
        for (const match of binding.template.matchAll(/\{\{([^{}]*)\}\}/g)) {
            const [root, id] = match[1]!.trim().split(".");
            if (root === "vars" && id) refs.push(id);
        }
        return refs;
    }

    return [];
};

/** Every var a definition depends on, deduplicated. */
export const varDependencies = (definition: VarDef): string[] => {
    const dependencies: string[] = [];

    if (definition.from) dependencies.push(...bindingVarRefs(definition.from));

    for (const transform of definition.transform ?? []) {
        if (transform.op === "concat") {
            for (const value of transform.values ?? []) {
                dependencies.push(...bindingVarRefs(value));
            }
        }
    }

    for (const value of Object.values(definition.args ?? {})) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            const candidate = value as Record<string, unknown>;
            if (
                "lit" in candidate ||
                "var" in candidate ||
                "step" in candidate ||
                "template" in candidate
            ) {
                dependencies.push(...bindingVarRefs(value as Binding));
            }
        }
    }

    return [...new Set(dependencies)];
};
