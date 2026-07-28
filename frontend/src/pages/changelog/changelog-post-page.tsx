import { Link, useParams } from "react-router-dom";
import { ChangelogBlock, getChangelogPost, getChangelogPosts } from "../../client/changelog/changelog-posts";
import { ChangelogTagPill } from "./changelog-tag-pill";
import { changelogFilterLink } from "./use-changelog-filter";
import { formatPostDate } from "./changelog-page";

export const ChangelogPostPage: React.FC = () => {
  const { slug } = useParams();
  const post = slug ? getChangelogPost(slug) : undefined;

  if (!post) {
    return (
      <div className="w-full px-4 flex flex-col items-center">
        <div className="w-full max-w-2xl bg-primary-background text-primary-text rounded-lg p-6 text-center">
          <p>That post does not exist.</p>
          <Link to="/changelog" className="underline mt-2 inline-block">
            Back to the changelog
          </Link>
        </div>
      </div>
    );
  }

  const posts = getChangelogPosts();
  const index = posts.findIndex((p) => p.slug === post.slug);
  const newer = index > 0 ? posts[index - 1] : undefined;
  const older = index < posts.length - 1 ? posts[index + 1] : undefined;

  return (
    <div className="w-full px-2 xs:px-4 flex flex-col items-center gap-4">
      <article className="w-full max-w-2xl bg-primary-background text-primary-text border border-primary-text/10 rounded-lg p-4 sm:p-6">
        <Link to="/changelog" className="text-sm opacity-70 hover:opacity-100 underline">
          ← Changelog
        </Link>

        <p className="text-xs opacity-60 mt-4 tabular-nums">{formatPostDate(post.date)}</p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">{post.title}</h1>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {post.tags.map((tag) => (
            <Link key={tag} to={changelogFilterLink(tag)}>
              <ChangelogTagPill tag={tag} size="sm" />
            </Link>
          ))}
        </div>

        <p className="text-base opacity-80 mt-5 border-l-2 border-primary-text/30 pl-4">{post.summary}</p>

        <div className="mt-5 flex flex-col gap-4">
          {post.body.map((block, blockIndex) => (
            <Block key={blockIndex} block={block} />
          ))}
        </div>
      </article>

      <nav className="w-full max-w-2xl flex flex-col xs:flex-row gap-3">
        {older && <NeighbourLink post={older} direction="older" />}
        {newer && <NeighbourLink post={newer} direction="newer" />}
      </nav>
    </div>
  );
};

/**
 * Renders `backtick wrapped` spans in post text as inline code. Deliberately the
 * only markup posts support - anything more wants a markdown dependency.
 */
const InlineText: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split("`").map((part, index) =>
      index % 2 === 1 ? (
        <code key={index} className="font-mono text-[0.9em] bg-primary-text/10 rounded px-1 py-0.5">
          {part}
        </code>
      ) : (
        part
      ),
    )}
  </>
);

const Block: React.FC<{ block: ChangelogBlock }> = ({ block }) => {
  if (block.kind === "list") {
    return (
      <ul className="flex flex-col gap-2 pl-5 list-disc">
        {block.items.map((item, index) => (
          <li key={index} className="opacity-90">
            <InlineText text={item} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="opacity-90">
      <InlineText text={block.text} />
    </p>
  );
};

const NeighbourLink: React.FC<{
  post: ReturnType<typeof getChangelogPosts>[number];
  direction: "older" | "newer";
}> = ({ post, direction }) => (
  <Link
    to={`/changelog/${post.slug}`}
    className="flex-1 bg-primary-background text-primary-text border border-primary-text/10 rounded-lg p-4 hover:bg-secondary-background hover:text-secondary-text hover:border-secondary-background transition-colors"
  >
    <p className="text-xs opacity-60">{direction === "older" ? "← Older" : "Newer →"}</p>
    <p className="text-sm font-medium mt-1">{post.title}</p>
  </Link>
);
