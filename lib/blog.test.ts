import { describe, expect, it } from "vitest";
import { getRelatedPosts, getAllPostsMeta } from "./blog";

describe("getRelatedPosts", () => {
    it("never returns the current post", () => {
        const posts = getAllPostsMeta();
        const current = posts[0];
        const related = getRelatedPosts(current);

        expect(related.find((p) => p.slug === current.slug)).toBeUndefined();
    });

    it("same category outranks a single shared tag", () => {
        const posts = getAllPostsMeta();
        const current = {
            ...posts[0],
            slug: "test-current-post",
            category: "Tutorials", // matches making-your-first-pull-request
            tags: ["gsoc"], // matches gsoc-vs-gssoc-vs-esoc
        };

        const related = getRelatedPosts(current, 10);

        const categoryMatchIndex = related.findIndex((p) => p.slug === "making-your-first-pull-request");
        const tagMatchIndex = related.findIndex((p) => p.slug === "gsoc-vs-gssoc-vs-esoc");

        expect(categoryMatchIndex).toBeGreaterThan(-1);
        expect(tagMatchIndex).toBeGreaterThan(-1);
        expect(categoryMatchIndex).toBeLessThan(tagMatchIndex);
    });

    it("posts with no category or tag in common are excluded", () => {
        const posts = getAllPostsMeta();
        const current = {
            ...posts[0],
            slug: "test-zero-overlap-post",
            category: "NonExistentCategory12345",
            tags: ["NonExistentTag12345"],
        };
        const related = getRelatedPosts(current);

        expect(related.length).toBe(0);
    });

    it("limit is respected", () => {
        const posts = getAllPostsMeta();
        const current = {
            ...posts[0],
            slug: "test-current-post",
            category: "Tutorials",
            tags: ["gsoc"],
        };

        const limit = 1;
        const related = getRelatedPosts(current, limit);

        expect(related.length).toBe(limit);
    });
});
