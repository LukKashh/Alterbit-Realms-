import React from 'react';

interface LoadingScreenProps {
  title: string;
  subtitle?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ title, subtitle }) => {
  return (
    <div
      data-testid="loading-screen"
      className="fixed inset-0 z-40 bg-[#b6d6f4]/55 backdrop-blur-md flex flex-col items-center justify-center p-6 gap-5"
    >
      <div className="pixel-box p-6 flex flex-col items-center gap-4 max-w-sm w-full">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] border-2 border-[#15803d] bg-[#22c55e] animate-bounce shadow-[0_3px_0_#14532d]" />
          <div
            className="w-9 h-9 rounded-[8px] border-2 border-[#b45309] bg-[#f59e0b] animate-bounce shadow-[0_3px_0_#78350f]"
            style={{ animationDelay: '120ms' }}
          />
          <div
            className="w-9 h-9 rounded-[8px] border-2 border-[#0369a1] bg-[#0ea5e9] animate-bounce shadow-[0_3px_0_#0c4a6e]"
            style={{ animationDelay: '240ms' }}
          />
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <h2 className="font-pixel text-base text-[#091e3a] tracking-wide">{title}</h2>
          {subtitle && <p className="text-xs font-semibold text-[#23476d]">{subtitle}</p>}
        </div>

        <div className="w-full h-2.5 rounded-full bg-white/80 border border-[#4172a3] overflow-hidden">
          <div className="h-full w-2/3 rounded-full bg-[#16a34a] animate-pulse" />
        </div>
      </div>
    </div>
  );
};
