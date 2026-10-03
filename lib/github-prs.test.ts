import { describe, expect, it } from "vitest";
import { isQualityRepo, prState, repoNameFromUrl, type RepoFacts, type SearchedPR } from "./github-prs";

const basePR: SearchedPR = {
    title: "Test PR",
    html_url: "https://github.com/vercel/next.js/pull/1",
    number: 1,
    repository_url: "https://api.github.com/repos/vercel/next.js",
    created_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    state: "open",
};

describe("prState", () => {
    it("returns merged when merged_at is set, even if state is closed", () => {
        expect(prState({ ...basePR, state: "closed", pull_request: { merged_at: "2026-01-02T00:00:00Z" } })).toBe("merged");
    });

    it("returns closed when state is closed with no merged_at", () => {
        expect(prState({ ...basePR, state: "closed", pull_request: { merged_at: null } })).toBe("closed");
    });

    it("returns open otherwise", () => {
        expect(prState({ ...basePR, state: "open" })).toBe("open");
    });
});

describe("repoNameFromUrl", () => {
    it("extracts owner and repo name from repository URL", () => {
        expect(repoNameFromUrl("https://api.github.com/repos/vercel/next.js")).toBe("vercel/next.js");
    });
});

describe("isQualityRepo", () => {
    it("returns false for null", () => {
        expect(isQualityRepo(null)).toBe(false);
    });

    it("returns true for exactly 100 stars and 100 forks", () => {
        expect(isQualityRepo({ name: "vercel/next.js", stars: 100, forks: 100 } satisfies RepoFacts)).toBe(true);
    });

    it("returns false for 99 stars and 100 forks", () => {
        expect(isQualityRepo({ name: "vercel/next.js", stars: 99, forks: 100 } satisfies RepoFacts)).toBe(false);
    });

    it("returns false for 100 stars and 99 forks", () => {
        expect(isQualityRepo({ name: "vercel/next.js", stars: 100, forks: 99 } satisfies RepoFacts)).toBe(false);
    });
});
