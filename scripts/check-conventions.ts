#!/usr/bin/env bun
/**
 * Enforce the AGENTS.md rules that can be checked mechanically:
 *
 * - every commit follows the subject + `LLM:` line format;
 * - no npm, pnpm, or Yarn lockfile is committed;
 * - migrations in `drizzle/` are forward-only.
 *
 * CI passes `GITHUB_BASE_SHA`; locally the check looks at `HEAD~1..HEAD`.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
    commitProblems,
    lockfileProblems,
    migrationProblems,
    summarize,
    type ChangedFile,
    type Commit
} from "./conventions.ts";

const git = (args: string[]): string =>
    execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const tryGit = (args: string[]): string | null => {
    try {
        return git(args);
    } catch {
        return null;
    }
};

const commitExists = (ref: string): boolean =>
    tryGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) !== null;

/** Base for `base..HEAD`; `null` means check only `HEAD`. */
const resolveBase = (): string | null => {
    const fromCi = process.env.GITHUB_BASE_SHA || process.env.GITHUB_EVENT_BEFORE || "";
    const isZero = /^0+$/.test(fromCi);

    if (fromCi && !isZero) {
        if (commitExists(fromCi)) return fromCi;
        console.warn(
            `conventions: base ${fromCi.slice(0, 7)} is not available; checking HEAD only`
        );
        return null;
    }

    return commitExists("HEAD~1") ? "HEAD~1" : null;
};

const readCommits = (base: string | null): Commit[] => {
    const range = base ? `${base}..HEAD` : "HEAD";
    const raw = git(["log", "--no-merges", "--format=%H%x00%B%x1e", range]);
    const commits: Commit[] = [];

    for (const record of raw.split("\x1e")) {
        const entry = record.trimStart();
        if (!entry) continue;

        const separator = entry.indexOf("\x00");
        if (separator === -1) continue;

        commits.push({
            hash: entry.slice(0, separator).trim(),
            message: entry.slice(separator + 1)
        });
    }

    return commits;
};

const readMigrationChanges = (base: string | null): ChangedFile[] => {
    const range = base ? `${base}..HEAD` : "HEAD";
    const files: ChangedFile[] = [];

    const committed = git([
        "diff",
        "--name-status",
        "--no-renames",
        "--diff-filter=MD",
        range,
        "--",
        "drizzle"
    ]);

    for (const line of committed.split("\n")) {
        if (!line.trim()) continue;
        const [status, path] = line.split("\t");
        if (status && path) files.push({ status, path });
    }

    const working = git(["status", "--porcelain", "--no-renames", "--", "drizzle"]);

    for (const line of working.split("\n")) {
        if (!line.trim()) continue;
        const status = line.slice(0, 2);
        const path = line.slice(3).trim();
        if (path) files.push({ status, path });
    }

    return files;
};

const readLockfiles = (): string[] =>
    ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"].filter(
        (path) => existsSync(path) || Boolean(tryGit(["ls-files", "--", path]))
    );

const main = (): void => {
    const base = resolveBase();
    const commits = readCommits(base);

    const problems = [
        ...commitProblems(commits),
        ...lockfileProblems(readLockfiles()),
        ...migrationProblems(readMigrationChanges(base))
    ];

    if (problems.length > 0) {
        console.error("AGENTS.md conventions failed:\n");
        for (const problem of problems) console.error(`  - ${problem}`);
        console.error("\nSee AGENTS.md §4 and §5.");
        process.exit(1);
    }

    const scope = base ? ` since ${base.slice(0, 7)}` : "";
    // `git log` lists newest first.
    const latest = commits[0];
    console.log(
        `conventions: ${commits.length} commit${commits.length === 1 ? "" : "s"} checked${scope}` +
            (latest ? ` (latest ${summarize(latest.hash, latest.message)})` : "")
    );
};

main();
