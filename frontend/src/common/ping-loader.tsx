import React from "react";

interface PingPongLoaderProps {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
  ballColor?: string;
}

export const PingPongLoader: React.FC<PingPongLoaderProps> = ({
  size = 400,
  primaryColor = "#2563eb",
  secondaryColor = "#e11d48",
  ballColor = "#f97316",
}) => {
  return (
    <div className="flex items-center justify-center p-8">
      <svg width={size} height={size * 0.6} viewBox="0 0 200 120" className="overflow-visible">
        {/* Define gradients for a more polished look */}
        <defs>
          <linearGradient id="tableGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* Table */}
        <g>
          {/* Table top */}
          <rect x="20" y="60" width="160" height="4" fill="url(#tableGradient)" rx="2" />

          {/* Table legs */}
          <rect x="35" y="64" width="3" height="20" fill="#475569" />
          <rect x="162" y="64" width="3" height="20" fill="#475569" />

          {/* Net */}
          <rect x="99" y="48" width="2" height="16" fill="#64748b" />
          {/* <rect x="90" y="48" width="20" height="2" fill="#64748b" /> */}
        </g>

        {/* Left Paddle */}
        <g className="animate-ping-pong-left" style={{ transformOrigin: "40px 40px" }}>
          <ellipse cx="40" cy="40" rx="18" ry="20" fill={primaryColor} opacity="0.9" />
          <rect x="38" y="58" width="4" height="15" fill={primaryColor} opacity="0.7" rx="2" />
        </g>

        {/* Right Paddle */}
        <g className="animate-ping-pong-right" style={{ transformOrigin: "160px 40px" }}>
          <ellipse cx="160" cy="40" rx="18" ry="20" fill={secondaryColor} opacity="0.9" />
          <rect x="158" y="58" width="4" height="15" fill={secondaryColor} opacity="0.7" rx="2" />
        </g>

        {/* Ball */}
        <circle cx="100" cy="45" r="5" fill={ballColor} className="animate-ping-pong-ball">
          <animate attributeName="cx" values="60;140;60" dur="2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="45;35;45" dur="1s" repeatCount="indefinite" />
        </circle>

        <style>{`
          @keyframes pingPongLeft {
            0%, 100% { transform: rotate(-10deg) translateY(0px); }
            50% { transform: rotate(10deg) translateY(-5px); }
          }
          
          @keyframes pingPongRight {
            0%, 100% { transform: rotate(10deg) translateY(0px); }
            50% { transform: rotate(-10deg) translateY(-5px); }
          }
          
          .animate-ping-pong-left {
            animation: pingPongLeft 1s ease-in-out infinite;
          }
          
          .animate-ping-pong-right {
            animation: pingPongRight 1s ease-in-out infinite;
            animation-delay: 0.5s;
          }
        `}</style>
      </svg>
    </div>
  );
};
