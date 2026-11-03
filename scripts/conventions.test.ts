import { describe, expect, it } from "vitest";
import {
    commitProblems,
    lockfileProblems,
    migrationProblems,
    summarize,
    validateCommitMessage
} from "./conventions";

const valid = [
    "feat(runtime): add score binding resolution",
    "LLM: Model, High, Harness, Provider",
    "",
    "Explain why the change exists."
].join("\n");

describe("validateCommitMessage", () => {
    it("accepts a message that follows AGENTS.md", () => {
        expect(validateCommitMessage(valid)).toEqual([]);
    });

    it("accepts a commit with no body", () => {
        expect(
            validateCommitMessage("docs: fix typo\nLLM: Model, High, Harness, Provider")
        ).toEqual([]);
    });

    it("requires the LLM line on line 2", () => {
        const missing = "docs: fix typo\n\nLLM: Model, High, Harness, Provider";
        expect(validateCommitMessage(missing)).toContain("line 2 must be the LLM line");
    });

    it("requires all four LLM fields", () => {
        expect(validateCommitMessage("docs: fix typo\nLLM: Model, High")).toContain(
            "LLM line needs model, reasoning level, harness, and inference provider"
        );
    });

    it("requires a blank line between the LLM line and the body", () => {
        const message = "docs: fix typo\nLLM: Model, High, Harness, Provider\nbody";
        expect(validateCommitMessage(message)).toContain("line 3 must be blank");
    });

    it("rejects a subject that is not a conventional commit", () => {
        const message = "fixed stuff\nLLM: Model, High, Harness, Provider";
        expect(validateCommitMessage(message)).toContain(
            'subject is not a conventional commit: "fixed stuff"'
        );
    });

    it("rejects a subject longer than 72 characters", () => {
        const subject = `feat(core): ${"x".repeat(80)}`;
        expect(validateCommitMessage(`${subject}\nLLM: Model, High, Harness, Provider`)).toContain(
            `subject is ${subject.length} characters (max 72)`
        );
    });

    it("rejects an empty message", () => {
        expect(validateCommitMessage("")).toEqual(["subject line is empty"]);
    });
});

describe("commitProblems", () => {
    it("prefixes each problem with the short hash and subject", () => {
        const problems = commitProblems([
            { hash: "0123456789abcdef", message: "nope\nLLM: Model, High, Harness, Provider" }
        ]);

        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/^0123456 nope: /);
    });

    it("returns nothing when every commit follows the rules", () => {
        expect(commitProblems([{ hash: "0123456789abcdef", message: valid }])).toEqual([]);
    });
});

describe("lockfileProblems", () => {
    it("flags any package manager lockfile, at the root or nested", () => {
        expect(lockfileProblems(["package-lock.json"])).toHaveLength(1);
        expect(lockfileProblems(["apps/web/pnpm-lock.yaml"])).toHaveLength(1);
        expect(lockfileProblems(["yarn.lock"])).toHaveLength(1);
    });

    it("leaves Bun lockfiles alone", () => {
        expect(lockfileProblems(["bun.lock", "bun.lockb", "src/index.ts"])).toEqual([]);
    });
});

describe("migrationProblems", () => {
    it("flags edited and deleted migrations", () => {
        const problems = migrationProblems([
            { status: "M", path: "drizzle/0001_init.sql" },
            { status: " D", path: "drizzle/0002_add_apps.sql" }
        ]);

        expect(problems).toHaveLength(2);
        expect(problems[0]).toContain("drizzle/0001_init.sql");
    });

    it("allows new migrations and unrelated files", () => {
        expect(
            migrationProblems([
                { status: "A", path: "drizzle/0003_scores.sql" },
                { status: "M", path: "src/lib/server/db/schema.ts" },
                { status: "M", path: "drizzle/meta/_journal.json" }
            ])
        ).toEqual([]);
    });
});

describe("summarize", () => {
    it("keeps the short hash and the subject", () => {
        expect(summarize("abcdef1234567890", `${valid.split("\n")[0]}\nbody`)).toBe(
            "abcdef1 feat(runtime): add score binding resolution"
        );
    });
});
