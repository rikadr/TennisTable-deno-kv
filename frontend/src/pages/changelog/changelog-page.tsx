import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { CHANGELOG_POSTS, CHANGELOG_TAGS, ChangelogPost, ChangelogTag } from "./changelog-data";

const FILTER_PARAM = "tag";

// Tag color styling. Saturated tints that read on both light and dark themes.
const TAG_STYLES: Record<ChangelogTag, string> = {
  "New feature": "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
  "Improvement": "bg-violet-500/15 text-violet-400 border-violet-500/40",
  "Bug fix": "bg-rose-500/15 text-rose-400 border-rose-500/40",
  "Achievement": "bg-amber-500/15 text-amber-500 border-amber-500/40",
  "Tournament": "bg-yellow-500/15 text-yellow-500 border-yellow-500/40",
  "Game": "bg-pink-500/15 text-pink-400 border-pink-500/40",
  "Technology": "bg-sky-500/15 text-sky-400 border-sky-500/40",
  "Admin": "bg-slate-500/20 text-slate-300 border-slate-500/40",
  "Theme": "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/40",
};

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD. Parse the parts directly to avoid timezone shifts.
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const TagPill: React.FC<{
  tag: ChangelogTag;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}> = ({ tag, count, active, onClick }) => {
  const content = (
    <>
      {tag}
      {count !== undefined && <span className="opacity-60">({count})</span>}
    </>
  );

  if (!onClick) {
    return (
      <span
        className={classNames(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
          TAG_STYLES[tag],
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
        active ? TAG_STYLES[tag] + " ring-2 ring-current" : "border-primary-text/30 text-secondary-text hover:border-primary-text",
      )}
    >
      {content}
    </button>
  );
};

const PostCard: React.FC<{ post: ChangelogPost; onTagClick: (tag: ChangelogTag) => void }> = ({ post, onTagClick }) => {
  return (
    <article className="rounded-xl border border-primary-text/15 bg-secondary-background/40 p-5 md:p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="text-3xl md:text-4xl leading-none select-none" aria-hidden>
          {post.icon}
        </div>
        <div className="min-w-0 flex-1">
          <time className="text-xs uppercase tracking-wide text-secondary-text/70">{formatDate(post.date)}</time>
          <h2 className="mt-0.5 text-lg md:text-xl font-bold text-primary-text">{post.title}</h2>
          <p className="mt-2 text-sm md:text-base text-secondary-text leading-relaxed">{post.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <button key={tag} type="button" onClick={() => onTagClick(tag)} title={`Filter by ${tag}`}>
                <TagPill tag={tag} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
};

export const ChangelogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTag = searchParams.get(FILTER_PARAM) as ChangelogTag | null;

  const setSelectedTag = (tag: ChangelogTag | null) => {
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        if (tag === null) {
          params.delete(FILTER_PARAM);
        } else {
          params.set(FILTER_PARAM, tag);
        }
        return params;
      },
      { replace: true },
    );
  };

  // Count posts per tag for the filter bar.
  const tagCounts = useMemo(() => {
    const counts = {} as Record<ChangelogTag, number>;
    for (const tag of CHANGELOG_TAGS) counts[tag] = 0;
    for (const post of CHANGELOG_POSTS) {
      for (const tag of post.tags) counts[tag] += 1;
    }
    return counts;
  }, []);

  const posts = useMemo(() => {
    const sorted = [...CHANGELOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));
    if (!selectedTag) return sorted;
    return sorted.filter((post) => post.tags.includes(selectedTag));
  }, [selectedTag]);

  // Only offer filter pills for tags that actually appear on a post.
  const availableTags = CHANGELOG_TAGS.filter((tag) => tagCounts[tag] > 0);

  return (
    <div className="min-h-screen bg-primary-background text-primary-text">
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold">📰 Changelog</h1>
          <p className="mt-2 text-secondary-text">
            What's new in Tennis Table. Tap a tag to filter the timeline.
          </p>
        </header>

        {/* Filter bar */}
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <TagPillAll active={selectedTag === null} count={CHANGELOG_POSTS.length} onClick={() => setSelectedTag(null)} />
          {availableTags.map((tag) => (
            <TagPill
              key={tag}
              tag={tag}
              count={tagCounts[tag]}
              active={selectedTag === tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            />
          ))}
        </div>

        {/* Timeline */}
        {posts.length === 0 ? (
          <p className="text-secondary-text">No posts for this tag.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((post) => (
              <PostCard key={post.date + post.title} post={post} onTagClick={(tag) => setSelectedTag(tag)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TagPillAll: React.FC<{ active: boolean; count: number; onClick: () => void }> = ({ active, count, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={classNames(
      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all",
      active
        ? "bg-primary-text/10 text-primary-text border-primary-text ring-1 ring-primary-text"
        : "border-primary-text/30 text-secondary-text hover:border-primary-text",
    )}
  >
    All <span className="opacity-60">({count})</span>
  </button>
);
