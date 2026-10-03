import { describe, expect, it } from "vitest";
import {
    checkArena,
    checkAuthor,
    checkKind,
    EvidenceError,
    isMilestoneUnlocked,
    signedOffCount,
    emptyJourney,
    validateReflection,
    JourneyRecord,
    JourneyEntry,
    Evidence,
    Reflection,
    EntryState,
    type EvidenceRule,
} from "./pr-journey";
import { GithubIdentity } from "./github-auth";

function words(n: number): string {
    return Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
}

function getReflection(over: Partial<Record<"tried" | "broke" | "differently", number>> = {}): Reflection {
    return {
        tried: words(over.tried ?? 5),
        broke: words(over.broke ?? 5),
        reviewerSaid: "The reviewer asked for a smaller diff.",
        differently: words(over.differently ?? 5),
        hours: 2,
        rounds: 1,
        status: "open" as const,
    };
}

function getJourneyEntry(reflection: Reflection, evidence: Evidence, state: EntryState): JourneyEntry {
    return {
        n: 100,
        evidence,
        reflection,
        state,
        submittedAt: new Date().toISOString(),
    };
}

describe("validateReflection", () => {
    it("returns trimmed text and converted numeric values for a valid reflection", () => {
        const result = validateReflection({
            tried: "  tried something  ",
            broke: "  broke into five words here  ",
            reviewerSaid: "  small diff please  ",
            differently: "  test first next time  ",
            hours: "3.5",
            rounds: "2",
            status: "merged",
        });
        expect(result).toEqual({
            tried: "tried something",
            broke: "broke into five words here",
            reviewerSaid: "small diff please",
            differently: "test first next time",
            hours: 3.5,
            rounds: 2,
            status: "merged",
        });
    });

    it.each([null, undefined, "not an object", 42])("throws when input is %s", (input) => {
        expect(() => validateReflection(input)).toThrow(new EvidenceError("The reflection is missing."));
    });

    it.each([
        ["tried", "What I tried"],
        ["broke", "What broke"],
        ["reviewerSaid", "What the reviewer said"],
        ["differently", "What I would do differently"],
    ])("throws when %s is empty, naming the field", (field, label) => {
        expect(() => validateReflection({ ...getReflection(), [field]: "   " })).toThrow(
            new EvidenceError(`"${label}" is empty. Every field is required.`),
        );
    });

    it("throws when a field is over its word cap and passes at the cap", () => {
        const cases = [
            { field: "tried" as const, cap: 100, label: "What I tried" },
            { field: "broke" as const, cap: 100, label: "What broke" },
            { field: "differently" as const, cap: 60, label: "What I would do differently" },
        ];
        for (const { field, cap, label } of cases) {
            expect(() => validateReflection(getReflection({ [field]: cap + 1 }))).toThrow(
                new EvidenceError(`"${label}" is capped at ${cap} words — yours is ${cap + 1}. Cut it down.`),
            );
            expect(() => validateReflection(getReflection({ [field]: cap }))).not.toThrow();
        }
    });

    it("enforces a minimum of 5 words for 'What broke'", () => {
        expect(() => validateReflection({ ...getReflection(), broke: "only four words here" })).toThrow(
            new EvidenceError('"What broke" needs a real answer. If nothing broke, the task was too small.'),
        );
        expect(() => validateReflection({ ...getReflection(), broke: "exactly five words are here" })).not.toThrow();
    });

    it.each([0, -1, "abc"])("throws when hours is %s", (hours) => {
        expect(() => validateReflection({ ...getReflection(), hours })).toThrow(
            new EvidenceError("Hours spent has to be a positive number."),
        );
    });

    it("validates rounds accepts non-negative integers and rejects others", () => {
        expect(validateReflection({ ...getReflection(), rounds: 0 }).rounds).toBe(0);
        expect(validateReflection({ ...getReflection(), rounds: "2" }).rounds).toBe(2);
        for (const invalid of [-1, 1.5, "abc"]) {
            expect(() => validateReflection({ ...getReflection(), rounds: invalid })).toThrow(
                new EvidenceError("Rounds of review has to be zero or more."),
            );
        }
    });

    it("validates status accepts merged, open or closed and rejects others", () => {
        for (const status of ["merged", "open", "closed"]) {
            expect(validateReflection({ ...getReflection(), status }).status).toBe(status);
        }
        for (const invalid of ["draft", "", "pending"]) {
            expect(() => validateReflection({ ...getReflection(), status: invalid })).toThrow(
                new EvidenceError("Status has to be merged, open or closed."),
            );
        }
    });
});

describe("isMilestoneUnlocked", () => {
    it("always opens milestone 1", () => {
        expect(isMilestoneUnlocked({}, 1)).toBe(true);
    });

    it("opens the next milestone once the previous one is submitted or signed off", () => {
        expect(isMilestoneUnlocked({ "1": { state: "submitted" } }, 2)).toBe(true);
        expect(isMilestoneUnlocked({ "1": { state: "signed-off" } }, 2)).toBe(true);
    });

    it("keeps it closed when the previous one is missing or was sent back", () => {
        expect(isMilestoneUnlocked({}, 2)).toBe(false);
        expect(isMilestoneUnlocked({ "1": { state: "changes-requested" } }, 2)).toBe(false);
        expect(isMilestoneUnlocked({ "1": { state: "submitted" } }, 3)).toBe(false);
    });
});

describe("checkArena", () => {
    it.each(["workbook", "club"] as const)(
        "allows the DevForge organization for the %s arena, regardless of case",
        (arena) => {
            expect(() => checkArena("NST-DEVFORGE", arena)).not.toThrow();
            expect(() => checkArena("nst-devforge", arena)).not.toThrow();
            expect(() => checkArena("NsT-DeVfOrGe", arena)).not.toThrow();
        },
    );

    it.each(["workbook", "club"] as const)(
        "rejects a different organization for the %s arena",
        (arena) => {
            expect(() => checkArena("unrelated-org", arena)).toThrow(EvidenceError);
        },
    );

    it("rejects the DevForge organization for the external arena", () => {
        expect(() => checkArena("NST-DEVFORGE", "external")).toThrow(EvidenceError);
        expect(() => checkArena("nst-devforge", "external")).toThrow(EvidenceError);
    });

    it("rejects the member's own GitHub account, regardless of case", () => {
        expect(() =>
            checkArena("Jaydeep83721-Dev", "external", "jaydeep83721-dev"),
        ).toThrow(EvidenceError);
    });

    it("allows an unrelated organization for the external arena", () => {
        expect(() =>
            checkArena("unrelated-org", "external", "jaydeep83721-dev"),
        ).not.toThrow();
    });
});

describe("checkKind", () => {
    it("passes on a match", () => {
        expect(() => checkKind("pr", { kind: "pr" } as EvidenceRule)).not.toThrow();
        expect(() => checkKind("issue", { kind: "issue" } as EvidenceRule)).not.toThrow();
    });

    it("throws EvidenceError on a mismatch", () => {
        expect(() => checkKind("issue", { kind: "pr" } as EvidenceRule)).toThrow(EvidenceError);
        expect(() => checkKind("pr", { kind: "issue" } as EvidenceRule)).toThrow(EvidenceError);
    });
});

describe("checkAuthor", () => {
    it("with author self accepts the member's login and rejects others", () => {
        const me = { login: "member", id: 123 };
        const author = { login: "MEMBER", id: 123 };
        const other = { login: "other", id: 456 };

        expect(() => checkAuthor(author, { author: "self" } as EvidenceRule, me)).not.toThrow();
        expect(() => checkAuthor(other, { author: "self" } as EvidenceRule, me)).toThrow(EvidenceError);
    });

    it("with author other rejects the member's own PR", () => {
        const me = { login: "member", id: 123 };
        const author = { login: "member", id: 123 };
        const other = { login: "other", id: 456 };

        expect(() => checkAuthor(other, { author: "other" } as EvidenceRule, me)).not.toThrow();
        expect(() => checkAuthor(author, { author: "other" } as EvidenceRule, me)).toThrow(EvidenceError);
    });
});

describe("signedOffCount", () => {
    it("returns 0 for a falsy journey", () => {
        expect(signedOffCount(null)).toBe(0);
    });

    it("returns 0 for an empty journey", () => {
        const journey: JourneyRecord = emptyJourney({
            id: 1234,
            login: "c0d3r",
            name: "George Jetson",
            avatar: ""
        });

        expect(signedOffCount(journey)).toBe(0);
    });

    it("returns correct count by entry state for populated journey", () => {
        const reflectionVal: Reflection = getReflection({ tried: 5 });
        const evidenceVal: Evidence = {
            url: "https://github.com/",
            kind: "pr",
            repo: "DevForge",
            number: 1,
            title: "Add Unit Tests",
            author: "c0d3r",
            authorId: 1234,
            state: "open",
            reviewRounds: 1,
            openedAt: new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
        };
        const journey: JourneyRecord = {
            githubId: 1234,
            github: "c0d3r",
            name: "George Jetson",
            avatar: '',
            entries: {
                'ent1': getJourneyEntry(reflectionVal, evidenceVal, "signed-off"),
                'ent2': getJourneyEntry(reflectionVal, evidenceVal, "signed-off"),
                'ent3': getJourneyEntry(reflectionVal, evidenceVal, "submitted"),
            },
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        expect(signedOffCount(journey)).toBe(2);
    });
});

describe("emptyJourney", () => {
    it("maps identity into journey detail", () => {
        const identity: GithubIdentity = {
            id: 1234,
            login: "c0d3r",
            name: "George Jetson",
            avatar: "",
        };
        const empty = emptyJourney(identity);

        expect(empty.githubId).toEqual(identity.id);
        expect(empty.github).toEqual(identity.login);
        expect(empty.name).toEqual(identity.name);
        expect(empty.avatar).toEqual(identity.avatar);
        expect(Object.keys(empty.entries)).toStrictEqual([]);
        expect(empty.startedAt).toBeTruthy();
        expect(empty.updatedAt).toBeTruthy();
    })
});
