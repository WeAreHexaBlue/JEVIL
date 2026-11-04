import { describe, expect, it } from "vitest";
import {
    buildBenchRequest,
    CHOICE_OPTION_MAX,
    defaultBenchValues,
    SCORE_LEVEL_MAX,
    splitList
} from "./bench";

const values = {
    ...defaultBenchValues,
    state: "a moody forest",
    choiceOptions: "dusk, dawn, dusk,\n neon",
    scoreLevels: "calm\nsteady\nloud"
};

describe("splitList", () => {
    it("splits on commas and new lines, trims, dedupes, and caps", () => {
        expect(splitList(" a, b\n c, ,a ", 10)).toEqual(["a", "b", "c"]);
        expect(splitList("a,b,c", 2)).toEqual(["a", "b"]);
        expect(splitList("   ", 10)).toEqual([]);
    });
});

describe("buildBenchRequest", () => {
    it("builds the three-question request", () => {
        const request = buildBenchRequest(values);

        expect(request.state).toBe("a moody forest");
        expect(Object.keys(request.questions)).toEqual(["mood", "energy", "spark"]);

        const mood = request.questions.mood;
        expect(mood?.type).toBe("choice");
        expect(mood?.type === "choice" ? mood.criteria : undefined).toEqual({
            dusk: "dusk",
            dawn: "dawn",
            neon: "neon"
        });

        const energy = request.questions.energy;
        expect(energy?.type === "score" ? energy.criteria : undefined).toEqual([
            "calm",
            "steady",
            "loud"
        ]);
    });

    it("fills usable defaults for blank instructions and levels", () => {
        const request = buildBenchRequest({
            state: "",
            choiceInstructions: " ",
            choiceOptions: "one",
            scoreInstructions: "",
            scoreLevels: "",
            noulInstructions: ""
        });

        const energy = request.questions.energy;
        expect(energy?.type === "score" ? energy.criteria : undefined).toEqual([
            "quiet",
            "steady",
            "loud"
        ]);
        expect(request.questions.mood?.instructions).toBe("Pick the closest option.");
        expect(request.questions.spark?.instructions).toBe("How much does it spark?");
    });

    it("rejects a choice question with no options", () => {
        expect(() => buildBenchRequest({ ...values, choiceOptions: " , \n " })).toThrow();
    });

    it("keeps the caps in one place", () => {
        expect(CHOICE_OPTION_MAX).toBeGreaterThanOrEqual(2);
        expect(SCORE_LEVEL_MAX).toBeGreaterThanOrEqual(2);
    });
});
