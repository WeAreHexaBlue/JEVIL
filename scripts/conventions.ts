/**
 * Pure rules for the AGENTS.md conventions check. Kept free of git and fs so the
 * rules can be unit-tested; `check-conventions.ts` supplies the repository data.
 */

export const FORBIDDEN_LOCKFILES = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"] as const;

const CONVENTIONAL =
    /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9-]+\))?!?: \S.*$/;

const MAX_SUBJECT = 72;
const LLM_FIELDS = 4;

/** One commit parsed out of `git log`. */
export type Commit = { hash: string; message: string };

/** One path parsed out of `git diff --name-status` or `git status --porcelain`. */
export type ChangedFile = { status: string; path: string };

/**
 * Validate one commit message. Returns a list of human-readable problems, empty
 * when the message follows AGENTS.md §4.
 */
export const validateCommitMessage = (message: string): string[] => {
    const lines = message.replace(/\r\n/g, "\n").split("\n");
    const problems: string[] = [];

    const subject = lines[0] ?? "";
    if (subject.trim().length === 0) return ["subject line is empty"];

    if (subject.length > MAX_SUBJECT) {
        problems.push(`subject is ${subject.length} characters (max ${MAX_SUBJECT})`);
    }

    if (!CONVENTIONAL.test(subject)) {
        problems.push(`subject is not a conventional commit: "${subject}"`);
    }

    const llm = lines[1] ?? "";
    if (!llm.startsWith("LLM: ")) {
        problems.push("line 2 must be the LLM line");
    } else if (llm.split(",").length < LLM_FIELDS) {
        problems.push("LLM line needs model, reasoning level, harness, and inference provider");
    }

    if (lines.length > 2 && lines[2].trim() !== "") {
        problems.push("line 3 must be blank");
    }

    return problems;
};

/** Validate every commit in a range, keeping the hash for the report. */
export const commitProblems = (commits: Commit[]): string[] =>
    commits.flatMap(({ hash, message }) =>
        validateCommitMessage(message).map((problem) => `${summarize(hash, message)}: ${problem}`)
    );

/** Lockfiles from other package managers. Bun only. */
export const lockfileProblems = (paths: readonly string[]): string[] =>
    FORBIDDEN_LOCKFILES.filter((lockfile) =>
        paths.some((path) => path === lockfile || path.endsWith(`/${lockfile}`))
    ).map((lockfile) => `remove ${lockfile}; this repository uses Bun only`);

/**
 * Migrations are forward-only. An applied migration may not be edited or
 * deleted, whether the change is committed or still in the working tree.
 * Renames arrive here as an add plus a delete (`--no-renames`).
 */
export const migrationProblems = (files: readonly ChangedFile[]): string[] =>
    files
        .filter(
            ({ status, path }) =>
                path.startsWith("drizzle/") &&
                path.endsWith(".sql") &&
                (status.includes("M") || status.includes("D"))
        )
        .map(({ path }) => `edit the schema and add a new migration instead of changing ${path}`);

/** Quote a commit subject for a one-line report. */
export const summarize = (hash: string, message: string): string => {
    const subject = (message.split("\n")[0] ?? "").trim();
    return `${hash.slice(0, 7)} ${subject}`;
};
