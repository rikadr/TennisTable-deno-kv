type Props = {
  title: string;
  description?: string;
  /** Rendered in the card's top right corner, level with the title. */
  action?: React.ReactNode;
  children: React.ReactNode;
};

export const ContentCard: React.FC<Props> = ({ title, description, action, children }) => {
  return (
    // min-w-0 so a grid or flex parent clamps the card to its track instead of letting wide
    // content stretch it past the viewport, which would put the action out of reach.
    <div className="min-w-0 bg-primary-background text-primary-text rounded-xl p-3 md:p-6 pt-2 md:pt-3">
      <div className="flex items-start justify-between gap-3 mb-2 md:mb-4">
        <section className="flex flex-col gap-x-6 md:flex-row items-baseline">
          <h3 className="text-base md:text-lg font-semibold">{title}</h3>
          <p className="text-sm md:text-base">{description}</p>
        </section>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
};
