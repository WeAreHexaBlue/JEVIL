import { describe, expect, it } from "vitest";
import { getEditorTemplate } from "#lib/templates";
import { bindingChoices } from "./bindings";
import { nodeIdAtPointer } from "./pointers";

const app = () => getEditorTemplate("palette-oracle")!.blueprint;

describe("nodeIdAtPointer", () => {
    it("maps an issue pointer to the nearest node", () => {
        expect(nodeIdAtPointer(app().ui, "/ui")).toBe("root");
        expect(nodeIdAtPointer(app().ui, "/ui/children/0/props/text")).toBe("title");
        expect(nodeIdAtPointer(app().ui, "/ui/children/0")).toBe("title");
        expect(nodeIdAtPointer(app().ui, "/ui/children/4/children/0/props/value")).toBe(
            "dial-warmth"
        );
    });

    it("ignores pointers outside the ui tree and bad indexes", () => {
        expect(nodeIdAtPointer(app().ui, "/inputs/0/id")).toBeNull();
        expect(nodeIdAtPointer(app().ui, "/uix/children/0")).toBeNull();
        expect(nodeIdAtPointer(app().ui, "/ui/children/99")).toBeNull();
        expect(nodeIdAtPointer(app().ui, "/ui/children/nope")).toBe("root");
    });
});

describe("bindingChoices", () => {
    it("offers inputs, vars, and answer fields", () => {
        const choices = bindingChoices(app());
        const values = choices.map((choice) => choice.value);

        expect(values).toContain(JSON.stringify({ var: "inputs.word" }));
        expect(values).toContain(JSON.stringify({ var: "colors" }));
        expect(values).toContain(JSON.stringify({ step: "read", question: "family" }));
        expect(values).toContain(
            JSON.stringify({ step: "read", question: "family", pick: "choice" })
        );
        expect(values).toContain(
            JSON.stringify({ step: "read", question: "family", pick: "confidence" })
        );
        expect(values).toContain(
            JSON.stringify({ step: "read", question: "family", pick: "probabilities" })
        );
    });

    it("labels every option and keeps values parseable", () => {
        for (const choice of bindingChoices(app())) {
            expect(choice.label.length).toBeGreaterThan(0);
            expect(() => JSON.parse(choice.value)).not.toThrow();
        }
    });
});
