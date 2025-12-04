import React from 'react';

export const AuditLogIllustration = () => {
    return (
        <div className="w-full h-full flex items-center justify-center">
            <svg
                viewBox="0 0 400 300"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-auto max-w-md"
            >
                <style>
                    {`
            @keyframes scan {
              0% { transform: translateY(0); opacity: 0.8; }
              50% { transform: translateY(140px); opacity: 0.4; }
              100% { transform: translateY(0); opacity: 0.8; }
            }
            @keyframes pulse {
              0% { transform: scale(1); opacity: 0.5; }
              50% { transform: scale(1.05); opacity: 0.8; }
              100% { transform: scale(1); opacity: 0.5; }
            }
            @keyframes float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
              100% { transform: translateY(0px); }
            }
            .scan-beam {
              animation: scan 4s ease-in-out infinite;
            }
            .bg-pulse {
              animation: pulse 3s ease-in-out infinite;
            }
            .floating {
              animation: float 6s ease-in-out infinite;
            }
          `}
                </style>

                {/* Background Elements */}
                <circle cx="200" cy="150" r="120" fill="#E8F4FC" className="bg-pulse" />
                <circle cx="200" cy="150" r="90" fill="#D1E9F9" opacity="0.5" />

                {/* Main Document / Interface Board */}
                <g className="floating">
                    <rect x="100" y="60" width="200" height="180" rx="12" fill="white" stroke="#E5E7EB" strokeWidth="2" />

                    {/* Header Bar */}
                    <rect x="100" y="60" width="200" height="40" rx="12" fill="#F7F8FA" />
                    <rect x="100" y="90" width="200" height="10" fill="#F7F8FA" /> {/* Cover bottom radius of header */}
                    <circle cx="120" cy="80" r="4" fill="#EF4444" />
                    <circle cx="135" cy="80" r="4" fill="#F59E0B" />
                    <circle cx="150" cy="80" r="4" fill="#22C55E" />

                    {/* Content Lines */}
                    <rect x="120" y="120" width="120" height="8" rx="4" fill="#E5E7EB" />
                    <rect x="120" y="140" width="160" height="8" rx="4" fill="#E5E7EB" />
                    <rect x="120" y="160" width="140" height="8" rx="4" fill="#E5E7EB" />
                    <rect x="120" y="180" width="100" height="8" rx="4" fill="#E5E7EB" />
                    <rect x="120" y="200" width="150" height="8" rx="4" fill="#E5E7EB" />

                    {/* Active Item Highlight */}
                    <rect x="115" y="135" width="170" height="18" rx="4" fill="#2D9CDB" opacity="0.1" />
                </g>

                {/* Magnifying Glass / Scanner */}
                <g transform="translate(220, 160)" className="floating" style={{ animationDelay: '-1s' }}>
                    <circle cx="0" cy="0" r="40" stroke="#2D9CDB" strokeWidth="6" fill="rgba(255, 255, 255, 0.2)" />
                    <path d="M28 28 L45 45" stroke="#2D9CDB" strokeWidth="6" strokeLinecap="round" />

                    {/* Lens Reflection */}
                    <path d="M-25 -15 Q -15 -25 0 -28" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                </g>

                {/* Scanning Beam */}
                <g transform="translate(100, 70)">
                    <rect x="0" y="0" width="200" height="2" fill="#2D9CDB" className="scan-beam" opacity="0.8">
                        <animate attributeName="opacity" values="0.8;0.2;0.8" dur="4s" repeatCount="indefinite" />
                    </rect>
                    <rect x="0" y="0" width="200" height="40" fill="url(#scan-gradient)" className="scan-beam" />
                </g>

                <defs>
                    <linearGradient id="scan-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2D9CDB" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#2D9CDB" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
};
