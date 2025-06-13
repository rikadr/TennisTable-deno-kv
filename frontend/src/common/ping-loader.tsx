import React from "react";

export const PingPongLoader: React.FC = () => {
  const size = 400;
  const strokeWidth = 4;
  const speed = 2;
  const duration = 1.2 / speed;
  const racket1Color = "rgb(var(--color-tertiary-background))";
  const racket2Color = "rgb(var(--color-tertiary-background))";
  const tableColor = "rgb(var(--color-secondary-background))";
  const netColor = "rgb(var(--color-secondary-background))";
  const ballColor = "rgb(var(--color-primary-text))";

  return (
    <div className="flex items-center justify-center p-8">
      <svg width={size} height={size * 0.5} viewBox="0 0 200 100" fill="none" className="overflow-visible">
        {/* Simple table line */}
        <line x1="60" y1="70" x2="140" y2="70" stroke={tableColor} strokeWidth={strokeWidth} />

        {/* Net */}
        <line x1="100" y1="50" x2="100" y2="70" stroke={netColor} strokeWidth={strokeWidth} />

        {/* Left paddle - simple circle */}
        <g
          style={{
            animation: `minimalPaddleLeft ${duration}s ease-in-out infinite`,
            transformOrigin: "40px 50px",
          }}
        >
          <circle cx="40" cy="50" r="15" stroke={racket1Color} strokeWidth={strokeWidth} fill="none" />
          <line x1="40" y1="65" x2="40" y2="80" stroke={racket1Color} strokeWidth={strokeWidth * 1.5} />
        </g>

        {/* Right paddle - simple circle */}
        <g
          style={{
            animation: `minimalPaddleRight ${duration}s ease-in-out infinite`,
            animationDelay: `${duration / 2}s`,
            transformOrigin: "160px 50px",
          }}
        >
          <circle cx="160" cy="50" r="15" stroke={racket2Color} strokeWidth={strokeWidth} fill="none" />
          <line x1="160" y1="65" x2="160" y2="80" stroke={racket2Color} strokeWidth={strokeWidth * 1.5} />
        </g>

        {/* Ball - simple dot */}
        <circle
          cx="100"
          cy="50"
          r="4"
          fill={ballColor}
          style={{
            animation: `minimalBall ${duration}s linear infinite`,
          }}
        />

        <style>{`
          @keyframes minimalPaddleLeft {
            0%, 100% { 
              transform: rotate(0deg);
            }
            50% { 
              transform: rotate(-10deg) translateY(-3px);
            }
          }
          
          @keyframes minimalPaddleRight {
            0%, 100% { 
              transform: rotate(0deg);
            }
            50% { 
              transform: rotate(10deg) translateY(-3px);
            }
          }
          
          @keyframes minimalBall {
            0%, 100% { 
              transform: translate(-45px, 0px);
            }
            12.5% {
              transform: translate(-22.5px, -8px);
            }
            25% {
              transform: translate(0px, -10px);
            }
            37.5% {
              transform: translate(22.5px, -8px);
            }
            50% { 
              transform: translate(45px, 0px);
            }
            62.5% {
              transform: translate(22.5px, -8px);
            }
            75% {
              transform: translate(0px, -10px);
            }
            87.5% {
              transform: translate(-22.5px, -8px);
            }
          }
        `}</style>
      </svg>
    </div>
  );
};
