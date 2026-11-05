import { describe, expect, it } from "vitest";
import { getEditorTemplate } from "#lib/templates";
import { validateBlueprint, type UiNode } from "#lib/schema/blueprint";
import {
    collectNodeIds,
    duplicateNode,
    editableProps,
    findNode,
    findParent,
    insertNode,
    moveNode,
    removeNode,
    setInputs,
    setMeta,
    setNodeProp,
    uniqueNodeId,
    updateNode,
    upsertInput,
    removeInput
} from "./mutations";
import { canAdd, defaultNode, inputFor } from "./defaults";

const blueprint = () => structuredClone(getEditorTemplate("palette-oracle")!.blueprint);

describe("tree lookups", () => {
    it("finds the root and nested nodes", () => {
        const app = blueprint();
        const root = app.ui;

        expect(findNode(root, root.id)?.id).toBe(root.id);
        expect(findNode(root, "again")?.type).toBe("Button");
        expect(findNode(root, "nope")).toBeNull();
    });

    it("finds a parent and sibling index", () => {
        const app = blueprint();
        const found = findParent(app.ui, "again");

        expect(found?.parent.children?.[found.index]?.id).toBe("again");
        expect(findParent(app.ui, app.ui.id)).toBeNull();
    });
});

describe("node edits", () => {
    it("sets and deletes a prop without touching the original", () => {
        const app = blueprint();
        const before = findNode(app.ui, "title")!.props;

        const changed = setNodeProp(app, "title", "level", 3);
        expect(findNode(changed.ui, "title")!.props?.level).toBe(3);
        expect(before?.level).not.toBe(3);

        const cleared = setNodeProp(changed, "title", "level", undefined);
        expect(findNode(cleared.ui, "title")!.props).not.toHaveProperty("level");
    });

    it("inserts into a container at an index", () => {
        const app = blueprint();
        const child = defaultNode("Heading", "new-heading", app.inputs);
        const next = insertNode(app, "root", child, 0);

        expect(next.ui.children?.[0]?.id).toBe("new-heading");
        expect(next.ui.children?.length).toBe((app.ui.children?.length ?? 0) + 1);
    });

    it("refuses to remove the root", () => {
        const app = blueprint();
        expect(removeNode(app, app.ui.id)).toBe(app);

        const next = removeNode(app, "title");
        expect(findNode(next.ui, "title")).toBeNull();
    });

    it("moves a node among its siblings and clamps at the edge", () => {
        const app = blueprint();
        const children = app.ui.children!;
        const first = children[0]!.id;
        const second = children[1]!.id;

        const moved = moveNode(app, second, -1);
        expect(moved.ui.children?.[0]?.id).toBe(second);
        expect(moved.ui.children?.[1]?.id).toBe(first);

        expect(moveNode(app, first, -1)).toEqual(app);
        expect(moveNode(app, children.at(-1)!.id, 1)).toEqual(app);
    });

    it("duplicates a subtree with fresh, unique ids", () => {
        const app = blueprint();
        const source = findNode(app.ui, "title")!;
        const next = duplicateNode(app, source.id);
        const ids = collectNodeIds(next.ui);

        expect(ids.size).toBe(collectNodeIds(app.ui).size + 1);
        expect(findNode(next.ui, source.id)?.id).toBe(source.id);
        expect(next.ui.children?.filter((child) => child.type === "Heading").length).toBe(2);
    });

    it("generates unique ids for every component type", () => {
        const app = blueprint();
        const first = uniqueNodeId(app.ui, "ScoreDial");
        const second = uniqueNodeId(app.ui, "ScoreDial");

        expect(first).toBe("score-dial");
        expect(second).toBe("score-dial");
        const changed = insertNode(app, "root", defaultNode("ScoreDial", first, app.inputs));
        expect(uniqueNodeId(changed.ui, "ScoreDial")).toBe("score-dial-2");
    });
});

describe("meta and inputs", () => {
    it("patches meta", () => {
        const next = setMeta(blueprint(), { title: "Renamed", accent: "lime" });
        expect(next.meta.title).toBe("Renamed");
        expect(next.meta.accent).toBe("lime");
    });

    it("upserts and removes inputs", () => {
        const app = blueprint();
        const added = upsertInput(app, {
            id: "mood",
            type: "select",
            label: "Mood",
            options: [
                { value: "calm", label: "Calm" },
                { value: "loud", label: "Loud" }
            ]
        });

        expect(added.inputs.map((input) => input.id)).toContain("mood");
        expect(removeInput(added, "mood").inputs.map((input) => input.id)).not.toContain("mood");
        expect(setInputs(app, []).inputs).toEqual([]);
    });

    it("keeps a visual edit valid", () => {
        const next = updateNode(blueprint(), "title", (node) => ({ ...node, type: "Heading" }));
        expect(validateBlueprint(next).ok).toBe(true);
    });
});

describe("editor defaults", () => {
    it("gives every catalog component the props it needs", () => {
        const app = blueprint();
        const next = insertNode(app, "root", defaultNode("Heading", "heading", app.inputs));
        expect(findNode(next.ui, "heading")?.props).toMatchObject({ text: "Heading" });
    });

    it("links input components only to a matching input", () => {
        const app = blueprint();
        expect(inputFor("TextInput", app.inputs)?.id).toBe("word");
        expect(inputFor("TextArea", app.inputs)).toBeNull();
        expect(canAdd("TextInput", app.inputs)).toBe(true);
        expect(canAdd("TextArea", app.inputs)).toBe(false);
        expect(canAdd("Heading", app.inputs)).toBe(true);
    });

    it("lists editable props with required flags", () => {
        expect(editableProps("Heading")).toEqual([
            { key: "text", required: true },
            { key: "level", required: false },
            { key: "align", required: false }
        ]);
        expect(editableProps("NotAComponent")).toEqual([]);
    });
});

describe("duplicate subtree ids", () => {
    it("gives every copied sibling a distinct id", () => {
        const app = blueprint();
        const pair: UiNode = {
            type: "Stack",
            id: "pair",
            props: { direction: "column", gap: 2 },
            children: [
                { type: "Heading", id: "pair-a", props: { text: "A" } },
                { type: "Heading", id: "pair-b", props: { text: "B" } }
            ]
        };

        const next = duplicateNode(insertNode(app, "root", pair), "pair");
        const ids = collectNodeIds(next.ui);
        const count = (node: UiNode): number =>
            1 + (node.children ?? []).reduce((total, child) => total + count(child), 0);

        expect(ids.size).toBe(count(next.ui));
        expect(
            next.ui.children?.filter((child) => child.type === "Stack" && child.id !== "dials")
                .length
        ).toBe(2);
    });
});
