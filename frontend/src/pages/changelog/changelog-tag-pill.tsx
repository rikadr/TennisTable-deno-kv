import { classNames } from "../../common/class-names";
import { ChangelogTag, changelogTagIcon, changelogTagLabel } from "../../client/changelog/changelog-tags";

type Props = {
  tag: ChangelogTag;
  /** Renders in the selected style. */
  selected?: boolean;
  /** Shown after the label, for the filter row. */
  count?: number;
  size?: "sm" | "md";
  onClick?: () => void;
};

export const ChangelogTagPill: React.FC<Props> = ({ tag, selected = false, count, size = "md", onClick }) => {
  const content = (
    <>
      <span aria-hidden>{changelogTagIcon(tag)}</span>
      <span>{changelogTagLabel(tag)}</span>
      {count !== undefined && <span className="opacity-60 tabular-nums">{count}</span>}
    </>
  );

  const shared = classNames(
    "inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors",
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
    selected
      ? "bg-secondary-background text-secondary-text border-secondary-background"
      : "bg-transparent text-primary-text border-primary-text/30",
  );

  if (!onClick) {
    return <span className={shared}>{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={classNames(shared, "hover:border-primary-text active:scale-95")}
    >
      {content}
    </button>
  );
};
