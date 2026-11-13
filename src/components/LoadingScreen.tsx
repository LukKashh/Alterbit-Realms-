import React from 'react';

interface LoadingScreenProps {
  title: string;
  subtitle?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ title, subtitle }) => {
  return (
    <div
      data-testid="loading-screen"
      data-menu-screen="loading"
      className="fixed inset-0 z-40 bg-[#0b1622]/96 flex flex-col items-center justify-center p-6 gap-5"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded border-2 border-[#82e068] bg-[#4aa64d] animate-bounce shadow-[0_4px_0_#245926]" />
        <div
          className="w-9 h-9 rounded border-2 border-[#ffe18c] bg-[#f2b738] animate-bounce shadow-[0_4px_0_#7d5409]"
          style={{ animationDelay: '120ms' }}
        />
        <div
          className="w-9 h-9 rounded border-2 border-[#a8fff7] bg-[#38e8d8] animate-bounce shadow-[0_4px_0_#145c56]"
          style={{ animationDelay: '240ms' }}
        />
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <h2 className="font-pixel text-base text-[#fff8e8] tracking-wide">{title}</h2>
        {subtitle && <p className="text-xs font-semibold text-[#9cb5cc]">{subtitle}</p>}
      </div>

      <div className="w-64 h-2.5 rounded bg-[#08101a] border border-[#2d4863] overflow-hidden">
        <div className="h-full w-2/3 bg-[#4aa64d] animate-pulse" />
      </div>
    </div>
  );
};
