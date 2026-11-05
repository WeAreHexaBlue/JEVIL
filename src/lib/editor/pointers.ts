/**
 * Map a validator JSON pointer back to the node it belongs to, so clicking an
 * issue in the editor can focus the right component.
 */

import type { UiNode } from "#lib/schema/blueprint";

const decode = (segment: string): string => segment.replaceAll("~1", "/").replaceAll("~0", "~");

export const nodeIdAtPointer = (root: UiNode, pointer: string): string | null => {
    if (pointer !== "/ui" && !pointer.startsWith("/ui/")) return null;

    const parts = pointer.split("/").slice(1).map(decode);
    let node: UiNode | undefined = root;

    for (let index = 1; index < parts.length; index += 1) {
        const key = parts[index];

        if (key !== "children") return node?.id ?? null;

        const next = Number(parts[index + 1]);
        if (!Number.isInteger(next) || next < 0) return node?.id ?? null;

        node = node?.children?.[next];
        if (!node) return null;
        index += 1;
    }

    return node?.id ?? null;
};
