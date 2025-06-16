interface ShimmerProps {
  children: React.ReactNode;
  duration?: number;
  intensity?: "light" | "medium" | "strong";
  angle?: number;
  className?: string;
  enabled?: boolean;
  style?: React.CSSProperties;
}

export const Shimmer: React.FC<ShimmerProps> = ({
  children,
  duration = 2000,
  intensity = "medium",
  angle = 45,
  className = "",
  enabled = true,
  style,
}) => {
  const intensityClasses = {
    light: "from-transparent via-white/20 to-transparent",
    medium: "from-transparent via-white/40 to-transparent",
    strong: "from-transparent via-white/60 to-transparent",
  };

  const shimmerStyle = {
    animationDuration: `${duration}ms`,
    transform: `rotate(${angle}deg)`,
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {children}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={`absolute inset-0 bg-gradient-to-r ${enabled ? intensityClasses[intensity] : ""} animate-shimmer`}
          style={enabled ? shimmerStyle : undefined}
        />
      </div>
    </div>
  );
};
