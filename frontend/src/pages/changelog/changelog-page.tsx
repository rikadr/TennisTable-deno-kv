import { useMemo } from "react";
import { Link } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { ChangelogPost, changelogTagCounts, getChangelogPosts } from "../../client/changelog/changelog-posts";
import { ALL_CHANGELOG_TAGS } from "../../client/changelog/changelog-tags";
import { ChangelogTagPill } from "./changelog-tag-pill";
import { useChangelogFilter } from "./use-changelog-filter";

export const ChangelogPage: React.FC = () => {
  const { selectedTags, toggleTag, clearTags } = useChangelogFilter();

  const posts = useMemo(() => getChangelogPosts(), []);
  const tagCounts = useMemo(() => changelogTagCounts(), []);

  // A post matches if it carries any of the selected tags, so adding tags widens
  // the result instead of narrowing it to nothing.
  const visiblePosts = useMemo(() => {
    if (selectedTags.length === 0) return posts;
    return posts.filter((post) => post.tags.some((tag) => selectedTags.includes(tag)));
  }, [posts, selectedTags]);

  return (
    <div className="w-full px-2 xs:px-4 flex flex-col items-center gap-4">
      <div className="w-full max-w-3xl bg-primary-background text-primary-text border border-primary-text/10 rounded-lg p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Changelog</h1>
        <p className="text-sm opacity-70 mt-1">
          What has been built, why, and the occasional thing that got deleted again. Backfilled from the commit history
          all the way to the first commit in May 2024.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {ALL_CHANGELOG_TAGS.map((tag) => (
            <ChangelogTagPill
              key={tag}
              tag={tag}
              count={tagCounts.get(tag) ?? 0}
              selected={selectedTags.includes(tag)}
              onClick={() => toggleTag(tag)}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm">
          <p className="opacity-70">
            {visiblePosts.length} of {posts.length} post{posts.length !== 1 && "s"}
            {selectedTags.length > 1 && " · matching any selected tag"}
          </p>
          {selectedTags.length > 0 && (
            <button type="button" onClick={clearTags} className="underline hover:no-underline">
              Clear filter
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-3">
        {visiblePosts.map((post, index) => {
          const year = post.date.slice(0, 4);
          const previousYear = index === 0 ? undefined : visiblePosts[index - 1].date.slice(0, 4);
          return (
            <div key={post.slug} className="flex flex-col gap-3">
              {year !== previousYear && (
                <h2 className="text-primary-text text-lg font-semibold px-1 pt-2 tabular-nums">{year}</h2>
              )}
              <PostCard post={post} />
            </div>
          );
        })}

        {visiblePosts.length === 0 && (
          <p className="bg-primary-background text-primary-text border border-primary-text/10 rounded-lg p-6 text-center text-sm">
            No posts with those tags yet.
          </p>
        )}
      </div>
    </div>
  );
};

const PostCard: React.FC<{ post: ChangelogPost }> = ({ post }) => {
  const { selectedTags } = useChangelogFilter();

  return (
    <Link
      to={`/changelog/${post.slug}`}
      className={classNames(
        "block bg-primary-background text-primary-text border border-primary-text/10 rounded-lg p-4 sm:p-5",
        "hover:bg-secondary-background hover:text-secondary-text hover:border-secondary-background transition-colors",
      )}
    >
      <p className="text-xs opacity-60 tabular-nums">{formatPostDate(post.date)}</p>
      <h3 className="text-lg sm:text-xl font-semibold mt-1">{post.title}</h3>
      <p className="text-sm opacity-80 mt-2">{post.summary}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {post.tags.map((tag) => (
          <ChangelogTagPill key={tag} tag={tag} size="sm" selected={selectedTags.includes(tag)} />
        ))}
      </div>
    </Link>
  );
};

export function formatPostDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
