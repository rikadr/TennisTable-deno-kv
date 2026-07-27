import {
  CHANGELOG_POSTS,
  changelogTagCounts,
  getChangelogPost,
  getChangelogPosts,
} from "../changelog-posts";
import { ALL_CHANGELOG_TAGS, isChangelogTag } from "../changelog-tags";

describe("changelog posts", () => {
  it("has unique slugs", () => {
    const slugs = CHANGELOG_POSTS.map((post) => post.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has url safe slugs", () => {
    CHANGELOG_POSTS.forEach((post) => {
      expect(post.slug).toMatch(/^[a-z0-9-]+$/);
    });
  });

  it("has valid iso dates", () => {
    CHANGELOG_POSTS.forEach((post) => {
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(post.date).getTime())).toBe(false);
    });
  });

  it("has at least one known tag per post", () => {
    CHANGELOG_POSTS.forEach((post) => {
      expect(post.tags.length).toBeGreaterThan(0);
      post.tags.forEach((tag) => expect(isChangelogTag(tag)).toBe(true));
    });
  });

  it("does not repeat a tag within a post", () => {
    CHANGELOG_POSTS.forEach((post) => {
      expect(new Set(post.tags).size).toBe(post.tags.length);
    });
  });

  it("has a title, summary and body for every post", () => {
    CHANGELOG_POSTS.forEach((post) => {
      expect(post.title.length).toBeGreaterThan(0);
      expect(post.summary.length).toBeGreaterThan(0);
      expect(post.body.length).toBeGreaterThan(0);
    });
  });

  it("references short commit hashes", () => {
    CHANGELOG_POSTS.forEach((post) => {
      expect(post.commits.length).toBeGreaterThan(0);
      post.commits.forEach((commit) => {
        expect(commit.hash).toMatch(/^[0-9a-f]{7,40}$/);
        expect(commit.subject.length).toBeGreaterThan(0);
      });
    });
  });

  it("sorts posts newest first", () => {
    const dates = getChangelogPosts().map((post) => post.date);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
  });

  it("looks posts up by slug", () => {
    const first = getChangelogPosts()[0];
    expect(getChangelogPost(first.slug)).toBe(first);
    expect(getChangelogPost("does-not-exist")).toBeUndefined();
  });

  it("counts tags across all posts", () => {
    const counts = changelogTagCounts();
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    expect(total).toBe(CHANGELOG_POSTS.reduce((sum, post) => sum + post.tags.length, 0));
  });

  it("uses every tag in the vocabulary at least once", () => {
    const counts = changelogTagCounts();
    const unused = ALL_CHANGELOG_TAGS.filter((tag) => (counts.get(tag) ?? 0) === 0);
    expect(unused).toEqual([]);
  });
});
