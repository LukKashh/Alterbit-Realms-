import React from 'react';
import { formatHudNumber } from '../game/format.ts';
import { RedGemIcon } from './RedGemIcon.tsx';

interface ModeSelectionProps {
  playerName: string;
  level: number;
  gems: number;
  connected: boolean;
  onReconnectNow: () => void;
  onEnterWorld: (worldName: string) => void;
  onSignOut: () => void;
}

const MODES = [
  {
    id: 'nexus',
    title: 'NEXUS REALMS',
    subtitle: 'Build, own and share your personal realms.',
    detail: 'Persistent sandbox worlds · WorldCore & Share Locks',
    accent: 'border-[#5aa9e6] bg-[#0e2236] hover:border-[#8cd3ff]',
    ctaBg: 'bg-[#214b73] border-[#78c8f5] text-[#f0f9ff]',
    action: 'world',
    worldName: 'NEXUS',
  },
] as const;

const ModeArtwork: React.FC<{ modeId: (typeof MODES)[number]['id'] }> = ({ modeId }) => {
  return (
    <svg
      viewBox="0 0 240 68"
      className="w-full h-20 rounded-[8px] border-2 border-[#2c5885] bg-[#0a1826] mb-3"
      aria-hidden="true"
    >
      <rect width="240" height="68" fill="#183b5c" />
      <rect y="0" width="240" height="24" fill="#255885" />
      {/* Sun & Pixel Clouds */}
      <rect x="196" y="8" width="18" height="18" fill="#fff3b0" />
      <rect x="28" y="10" width="38" height="8" fill="#ffffff" opacity="0.88" />
      <rect x="36" y="6" width="22" height="6" fill="#fffde8" />
      <rect x="120" y="14" width="32" height="7" fill="#ffffff" opacity="0.82" />
      {/* Distant Mountains */}
      <polygon points="0,50 42,24 88,50" fill="#1b4366" />
      <polygon points="64,50 116,20 168,50" fill="#163754" />
      {/* Grass & Soil Terrace */}
      <rect y="46" width="240" height="6" fill="#57c863" />
      <rect y="52" width="240" height="16" fill="#7d5133" />
      {/* Entrance Portal & WorldCore */}
      <rect x="96" y="22" width="22" height="24" fill="#56697a" stroke="#141c24" strokeWidth="2" />
      <rect x="101" y="27" width="12" height="19" fill="#38e8d8" />
      <rect x="96" y="47" width="22" height="12" fill="#f2b738" stroke="#141c24" strokeWidth="2" />
      {/* Landlord Steward NPC */}
      <rect x="136" y="28" width="12" height="18" fill="#234b7a" stroke="#141c24" strokeWidth="2" />
      <rect x="137" y="20" width="10" height="8" fill="#f5cba3" />
      <rect x="136" y="15" width="12" height="6" fill="#1e3a5f" />
      {/* Planted Tree */}
      <rect x="52" y="32" width="6" height="14" fill="#6b4222" />
      <rect x="43" y="20" width="24" height="14" fill="#3da84f" stroke="#141c24" strokeWidth="2" />
    </svg>
  );
};

export const ModeSelection: React.FC<ModeSelectionProps> = ({
  playerName,
  level,
  gems,
  connected,
  onReconnectNow,
  onEnterWorld,
  onSignOut,
}) => (
  <div className="fixed inset-0 z-20 flex flex-col overflow-y-auto bg-[#091e3a]/55 backdrop-blur-sm p-3 sm:p-6">
    <main className="my-auto mx-auto w-full max-w-4xl pixel-box p-4 sm:p-6">
      <header className="pixel-box-header -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 py-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-pixel text-[10px] tracking-widest text-[#0369a1]">ALTERIA REALMS</p>
          <h1 className="mt-1 ui-pixel-heading text-lg text-[#091e3a]">Choose Your Realm</h1>
          <p className="mt-1 text-xs font-mono-num text-[#23476d] flex flex-wrap items-center gap-1.5">
            <span>{playerName} · Level {formatHudNumber(level)} ·</span>
            <span className="inline-flex items-center gap-1 font-bold text-[#091e3a]">
              <RedGemIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{formatHudNumber(gems)}</span>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`text-xs font-bold ${
              connected ? 'text-[#047857]' : 'text-[#b91c1c]'
            }`}
          >
            {connected ? 'Connected' : 'Reconnecting'}
          </span>
          {!connected && (
            <button
              type="button"
              onClick={onReconnectNow}
              className="pixel-btn pixel-btn-primary !py-1.5 !px-3 !text-xs whitespace-nowrap"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="pixel-btn pixel-btn-ruby !py-1.5 !px-3.5 !text-xs whitespace-nowrap"
          >
            Sign Out
          </button>
        </div>
      </header>
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            data-testid={`mode-${mode.id}`}
            onClick={() => onEnterWorld(mode.worldName)}
            className="pixel-slot p-4 text-left transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <ModeArtwork modeId={mode.id} />
              <span className="ui-pixel-heading text-xs text-[#091e3a] block">{mode.title}</span>
              <span className="mt-2 block text-sm font-semibold text-[#091e3a]">
                {mode.subtitle}
              </span>
              <span className="mt-1.5 block text-xs text-[#23476d]">{mode.detail}</span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="pixel-btn pixel-btn-primary !py-1.5 !px-3.5 !text-xs whitespace-nowrap">
                Enter Mode →
              </span>
            </div>
          </button>
        ))}
      </section>
      <p className="mt-4 text-center text-xs text-[#23476d]">
        Your account is shared across all modes · Personal realms are 30×50 hard-locked sanctuaries.
      </p>
    </main>
  </div>
);
