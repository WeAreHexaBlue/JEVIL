/**
 * Editor mutations on a validated blueprint.
 *
 * The visual editor only operates when `validateBlueprint` passes, so these
 * functions take and return `Blueprint`. Every edit clones; undo/redo can keep
 * snapshots without worrying about shared references.
 */

import type { Answer } from "#lib/decide/types";
import type { AppInput, AppMeta, Blueprint, PropValue, UiNode } from "#lib/schema/blueprint";
import { componentCatalog } from "#lib/runtime/catalog";

export interface ParentRef {
    parent: UiNode;
    index: number;
}

export const findNode = (root: UiNode, id: string): UiNode | null => {
    if (root.id === id) return root;
    for (const child of root.children ?? []) {
        const found = findNode(child, id);
        if (found) return found;
    }
    return null;
};

export const findParent = (root: UiNode, id: string): ParentRef | null => {
    const children = root.children ?? [];
    const index = children.findIndex((child) => child.id === id);
    if (index >= 0) return { parent: root, index };

    for (const child of children) {
        const found = findParent(child, id);
        if (found) return found;
    }
    return null;
};

export const collectNodeIds = (root: UiNode, into = new Set<string>()): Set<string> => {
    into.add(root.id);
    for (const child of root.children ?? []) collectNodeIds(child, into);
    return into;
};

const baseNodeId = (type: string): string => {
    const base =
        type
            .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48) || "node";

    return base.match(/^[a-z]/) ? base : `n-${base}`;
};

/**
 * Reserve the next free id from `used` and add it, so one duplicate pass never
 * hands the same id to two copies of the same component type.
 */
const takeNodeId = (used: Set<string>, type: string): string => {
    const rooted = baseNodeId(type);
    if (!used.has(rooted)) {
        used.add(rooted);
        return rooted;
    }

    for (let attempt = 2; attempt < 1000; attempt += 1) {
        const candidate = `${rooted.slice(0, 60)}-${attempt}`;
        if (!used.has(candidate)) {
            used.add(candidate);
            return candidate;
        }
    }

    const fallback = `node-${used.size.toString(36)}-${type.toLowerCase().slice(0, 12)}`;
    used.add(fallback);
    return fallback;
};

/** A unique, schema-valid node id derived from a component name. */
export const uniqueNodeId = (root: UiNode, type: string): string =>
    takeNodeId(collectNodeIds(root), type);

const mapNode = (node: UiNode, id: string, update: (node: UiNode) => UiNode): UiNode => {
    if (node.id === id) return update(node);
    if (!node.children) return node;

    return {
        ...node,
        children: node.children.map((child) => mapNode(child, id, update))
    };
};

export const updateNode = (
    blueprint: Blueprint,
    id: string,
    update: (node: UiNode) => UiNode
): Blueprint => ({ ...blueprint, ui: mapNode(blueprint.ui, id, update) });

/** Set a prop, or delete it when the value is `undefined`. */
export const setNodeProp = (
    blueprint: Blueprint,
    id: string,
    key: string,
    value: PropValue | undefined
): Blueprint =>
    updateNode(blueprint, id, (node) => {
        const props = { ...(node.props ?? {}) };
        if (value === undefined) delete props[key];
        else props[key] = value;
        return { ...node, props };
    });

export const setNodeVisible = (
    blueprint: Blueprint,
    id: string,
    visible: UiNode["visible"] | undefined
): Blueprint =>
    updateNode(blueprint, id, (node) => {
        const next = { ...node };
        if (visible === undefined) delete next.visible;
        else next.visible = visible;
        return next;
    });

/** Insert a node into a container. A non-container parent is left untouched. */
export const insertNode = (
    blueprint: Blueprint,
    parentId: string,
    node: UiNode,
    index?: number
): Blueprint =>
    updateNode(blueprint, parentId, (parent) => {
        const children = [...(parent.children ?? [])];
        const at =
            index === undefined ? children.length : Math.max(0, Math.min(index, children.length));
        children.splice(at, 0, node);
        return { ...parent, children };
    });

export const removeNode = (blueprint: Blueprint, id: string): Blueprint => {
    if (blueprint.ui.id === id) return blueprint;

    const strip = (node: UiNode): UiNode => {
        if (!node.children) return node;
        return {
            ...node,
            children: node.children.filter((child) => child.id !== id).map(strip)
        };
    };

    return { ...blueprint, ui: strip(blueprint.ui) };
};

/** Move a node up or down among its siblings. */
export const moveNode = (blueprint: Blueprint, id: string, delta: -1 | 1): Blueprint => {
    const parentRef = findParent(blueprint.ui, id);
    if (!parentRef || !parentRef.parent.children) return blueprint;

    const siblings = [...parentRef.parent.children];
    const target = parentRef.index + delta;
    if (target < 0 || target >= siblings.length) return blueprint;

    const [node] = siblings.splice(parentRef.index, 1);
    siblings.splice(target, 0, node!);

    return updateNode(blueprint, parentRef.parent.id, (parent) => ({
        ...parent,
        children: siblings
    }));
};

const deepCopyWithIds = (root: UiNode, node: UiNode): UiNode => {
    const used = collectNodeIds(root);
    const copy = structuredClone(node);

    const walk = (current: UiNode): UiNode => ({
        ...current,
        id: takeNodeId(used, current.type),
        children: current.children?.map(walk)
    });

    return walk(copy);
};

export const duplicateNode = (blueprint: Blueprint, id: string): Blueprint => {
    if (blueprint.ui.id === id) return blueprint;

    const parentRef = findParent(blueprint.ui, id);
    if (!parentRef || !parentRef.parent.children) return blueprint;

    const source = parentRef.parent.children[parentRef.index];
    if (!source) return blueprint;

    const copy = deepCopyWithIds(blueprint.ui, source);
    return insertNode(blueprint, parentRef.parent.id, copy, parentRef.index + 1);
};

export const setMeta = (blueprint: Blueprint, patch: Partial<AppMeta>): Blueprint => ({
    ...blueprint,
    meta: { ...blueprint.meta, ...patch }
});

export const setInputs = (blueprint: Blueprint, inputs: AppInput[]): Blueprint => ({
    ...blueprint,
    inputs
});

export const upsertInput = (blueprint: Blueprint, input: AppInput): Blueprint => {
    const index = blueprint.inputs.findIndex((item) => item.id === input.id);
    const inputs = [...blueprint.inputs];
    if (index >= 0) inputs[index] = input;
    else inputs.push(input);
    return { ...blueprint, inputs };
};

export const removeInput = (blueprint: Blueprint, id: string): Blueprint => ({
    ...blueprint,
    inputs: blueprint.inputs.filter((input) => input.id !== id)
});

/**
 * Store a test-bench run as the sample result, so the catalog and the detail
 * page can render the app without a model call.
 */
export const setPreviewAnswers = (
    blueprint: Blueprint,
    answers: Record<string, Record<string, Answer>>
): Blueprint => {
    const inputs: Record<string, string | number | boolean> = {};

    for (const input of blueprint.inputs) {
        const value = input.default;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            inputs[input.id] = value;
        } else if (input.type === "toggle") {
            inputs[input.id] = false;
        } else if (input.type === "slider") {
            inputs[input.id] = input.min ?? 0;
        } else {
            inputs[input.id] = "";
        }
    }

    return {
        ...blueprint,
        preview: {
            inputs: blueprint.preview?.inputs ?? inputs,
            answers
        }
    };
};

/** Best-effort root id for a draft that may not validate yet. */
export const rootNodeId = (blueprint: unknown): string => {
    if (typeof blueprint !== "object" || blueprint === null) return "root";
    const ui = (blueprint as { ui?: unknown }).ui;
    if (typeof ui !== "object" || ui === null) return "root";
    const id = (ui as { id?: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : "root";
};

/** Props an editor can offer for a component, in catalog order. */
export const editableProps = (type: string): { key: string; required: boolean }[] => {
    const spec = componentCatalog[type];
    if (!spec) return [];

    return Object.keys(spec.props).map((key) => ({
        key,
        required: spec.required.includes(key)
    }));
};
