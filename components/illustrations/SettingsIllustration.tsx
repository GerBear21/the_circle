import React from 'react';

export const SettingsIllustration = () => {
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
            @keyframes spin-slow {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes spin-reverse {
              0% { transform: rotate(360deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
              100% { transform: translateY(0px); }
            }
            @keyframes pulse-glow {
              0% { opacity: 0.5; transform: scale(1); }
              50% { opacity: 0.8; transform: scale(1.05); }
              100% { opacity: 0.5; transform: scale(1); }
            }
            @keyframes slide {
              0% { transform: translateX(0); }
              50% { transform: translateX(10px); }
              100% { transform: translateX(0); }
            }
            .gear-cw {
              transform-origin: center;
              animation: spin-slow 10s linear infinite;
            }
            .gear-ccw {
              transform-origin: center;
              animation: spin-reverse 8s linear infinite;
            }
            .floating {
              animation: float 6s ease-in-out infinite;
            }
            .slider-knob {
              animation: slide 4s ease-in-out infinite;
            }
          `}
                </style>

                {/* Background Glow */}
                <circle cx="200" cy="150" r="120" fill="#F0F9FF" className="floating" />
                <circle cx="200" cy="150" r="90" fill="#E0F2FE" opacity="0.6" />

                {/* Main Panel */}
                <g className="floating">
                    <rect x="80" y="60" width="240" height="180" rx="16" fill="white" stroke="#E2E8F0" strokeWidth="2" />

                    {/* Header */}
                    <path d="M80 76C80 67.1634 87.1634 60 96 60H304C312.837 60 320 67.1634 320 76V90H80V76Z" fill="#F8FAFC" />
                    <circle cx="100" cy="75" r="4" fill="#EF4444" />
                    <circle cx="115" cy="75" r="4" fill="#F59E0B" />
                    <circle cx="130" cy="75" r="4" fill="#22C55E" />

                    {/* Content Area */}

                    {/* Toggle Switches */}
                    <rect x="110" y="110" width="36" height="20" rx="10" fill="#E2E8F0" />
                    <circle cx="120" cy="120" r="8" fill="white" />

                    <rect x="110" y="145" width="36" height="20" rx="10" fill="#3B82F6" />
                    <circle cx="136" cy="155" r="8" fill="white" />

                    <rect x="110" y="180" width="36" height="20" rx="10" fill="#E2E8F0" />
                    <circle cx="120" cy="190" r="8" fill="white" />

                    {/* Lines */}
                    <rect x="160" y="116" width="120" height="8" rx="4" fill="#F1F5F9" />
                    <rect x="160" y="151" width="100" height="8" rx="4" fill="#F1F5F9" />
                    <rect x="160" y="186" width="130" height="8" rx="4" fill="#F1F5F9" />

                    {/* Sliders */}
                    <g transform="translate(260, 110)">
                        <rect x="0" y="0" width="4" height="100" rx="2" fill="#F1F5F9" />
                        <circle cx="2" cy="30" r="6" fill="#3B82F6" className="slider-knob" style={{ animationDelay: '0s' }} />
                        <circle cx="2" cy="70" r="6" fill="#64748B" className="slider-knob" style={{ animationDelay: '-2s' }} />
                    </g>
                </g>

                {/* Gears */}
                <g transform="translate(310, 230)" className="gear-cw">
                    <path d="M25.9 14.1C25.8 13.5 25.6 12.9 25.4 12.3L28.6 10.2C28.9 10 29 9.6 28.8 9.3L25.8 4.1C25.6 3.8 25.2 3.7 24.9 3.8L21.3 5.2C20.6 4.7 19.9 4.3 19.2 4L18.6 0.2C18.5 -0.1 18.2 -0.3 17.9 -0.3H11.9C11.6 -0.3 11.3 -0.1 11.2 0.2L10.6 4C9.9 4.3 9.2 4.7 8.5 5.2L4.9 3.8C4.6 3.7 4.2 3.8 4 4.1L1 9.3C0.8 9.6 0.9 10 1.2 10.2L4.4 12.3C4.2 12.9 4 13.5 3.9 14.1L0.2 14.7C-0.1 14.8 -0.3 15.1 -0.3 15.4V21.4C-0.3 21.7 -0.1 22 0.2 22.1L3.9 22.7C4 23.3 4.2 23.9 4.4 24.5L1.2 26.6C0.9 26.8 0.8 27.2 1 27.5L4 32.7C4.2 33 4.6 33.1 4.9 33L8.5 31.6C9.2 32.1 9.9 32.5 10.6 32.8L11.2 36.6C11.3 36.9 11.6 37.1 11.9 37.1H17.9C18.2 37.1 18.5 36.9 18.6 36.6L19.2 32.8C19.9 32.5 20.6 32.1 21.3 31.6L24.9 33C25.2 33.1 25.6 33 25.8 32.7L28.8 27.5C29 27.2 28.9 26.8 28.6 26.6L25.4 24.5C25.6 23.9 25.8 23.3 25.9 22.7L29.6 22.1C29.9 22 30.1 21.7 30.1 21.4V15.4C30.1 15.1 29.9 14.8 29.6 14.7L25.9 14.1ZM14.9 24.9C10.8 24.9 7.5 21.6 7.5 17.5C7.5 13.4 10.8 10.1 14.9 10.1C19 10.1 22.3 13.4 22.3 17.5C22.3 21.6 19 24.9 14.9 24.9Z" fill="#3B82F6" stroke="white" strokeWidth="1" />
                </g>

                <g transform="translate(60, 200)" className="gear-ccw">
                    <path d="M20.7 11.3C20.6 10.8 20.5 10.3 20.3 9.8L22.9 8.2C23.1 8 23.2 7.7 23 7.4L20.6 3.3C20.5 3 20.2 2.9 19.9 3L17 4.2C16.5 3.8 15.9 3.4 15.4 3.2L14.9 0.2C14.8 -0.1 14.6 -0.2 14.3 -0.2H9.5C9.3 -0.2 9 0 9 0.2L8.5 3.2C7.9 3.4 7.4 3.8 6.8 4.2L3.9 3C3.7 2.9 3.4 3 3.2 3.3L0.8 7.4C0.6 7.7 0.7 8 1 8.2L3.5 9.8C3.4 10.3 3.2 10.8 3.1 11.3L0.2 11.8C-0.1 11.8 -0.2 12.1 -0.2 12.3V17.1C-0.2 17.4 -0.1 17.6 0.2 17.7L3.1 18.2C3.2 18.7 3.4 19.1 3.5 19.6L1 21.3C0.7 21.4 0.6 21.8 0.8 22L3.2 26.2C3.4 26.4 3.7 26.5 3.9 26.4L6.8 25.3C7.4 25.7 7.9 26 8.5 26.3L9 29.3C9 29.5 9.3 29.7 9.5 29.7H14.3C14.6 29.7 14.8 29.5 14.9 29.3L15.4 26.3C15.9 26 16.5 25.7 17 25.3L19.9 26.4C20.2 26.5 20.5 26.4 20.6 26.2L23 22C23.2 21.8 23.1 21.4 22.9 21.3L20.3 19.6C20.5 19.1 20.6 18.6 20.7 18.2L23.7 17.7C23.9 17.6 24.1 17.4 24.1 17.1V12.3C24.1 12.1 23.9 11.8 23.7 11.8L20.7 11.3ZM11.9 19.9C8.6 19.9 6 17.3 6 14C6 10.7 8.6 8.1 11.9 8.1C15.2 8.1 17.8 10.7 17.8 14C17.8 17.3 15.2 19.9 11.9 19.9Z" fill="#64748B" stroke="white" strokeWidth="1" />
                </g>

                {/* Decorative Elements */}
                <circle cx="340" cy="100" r="6" fill="#F59E0B" className="floating" style={{ animationDelay: '-1s' }} />
                <circle cx="50" cy="250" r="8" fill="#22C55E" className="floating" style={{ animationDelay: '-3s' }} />
            </svg>
        </div>
    );
};
