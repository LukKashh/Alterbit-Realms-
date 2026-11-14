import React from 'react';

interface ModeSelectionProps {
  playerName: string;
  level: number;
  gems: number;
  connected: boolean;
  onReconnectNow: () => void;
  onEnterWorld: (worldName: string) => void;
  onOpenDungeons: () => void;
  onOpenFishing3d: () => void;
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
  {
    id: 'dungeons',
    title: 'DUNGEONS',
    subtitle: 'Enter third-person expeditions and defeat dungeon guardians.',
    detail: '3D combat adventures · 5 Gate Key tiers',
    accent: 'border-[#d89b38] bg-[#241b10] hover:border-[#ffe18c]',
    ctaBg: 'bg-[#5c3d14] border-[#f2b738] text-[#fff8e8]',
    action: 'dungeon',
    worldName: 'STATION',
  },
  {
    id: 'fishing',
    title: 'FISCORE',
    subtitle: 'Explore the waters and master the fishing depths.',
    detail: '3D Desert Island · Bamboo Rod & Starter Bait',
    accent: 'border-[#2fb8b0] bg-[#0d262b] hover:border-[#7cf7ee]',
    ctaBg: 'bg-[#144c52] border-[#38e8d8] text-[#e8ffff]',
    action: 'fishing_3d',
    worldName: 'FISHING',
  },
  {
    id: 'cave',
    title: 'CAVE DWELLER',
    subtitle: 'Descend through strata, mine ores and refine resources.',
    detail: 'Underground progression · 12 metallurgy tiers',
    accent: 'border-[#44b562] bg-[#102619] hover:border-[#8ef0a4]',
    ctaBg: 'bg-[#1b4d2b] border-[#4ec46a] text-[#ecfff0]',
    action: 'world',
    worldName: 'DWELLER',
  },
] as const;

const ModeArtwork: React.FC<{ modeId: (typeof MODES)[number]['id'] }> = ({ modeId }) => {
  if (modeId === 'nexus') {
    return (
      <svg
        viewBox="0 0 240 68"
        className="w-full h-20 rounded border border-[#2b4d6e] bg-[#0a1826] mb-3"
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
  }
  if (modeId === 'dungeons') {
    return (
      <svg
        viewBox="0 0 240 68"
        className="w-full h-20 rounded border border-[#5c4320] bg-[#140f0a] mb-3"
        aria-hidden="true"
      >
        <rect width="240" height="68" fill="#16121f" />
        {/* 3D Dungeon Masonry Columns & Floor */}
        <rect y="44" width="240" height="24" fill="#261f36" />
        <rect x="16" y="8" width="28" height="40" fill="#3b3254" stroke="#120e1c" strokeWidth="2" />
        <rect x="196" y="8" width="28" height="40" fill="#3b3254" stroke="#120e1c" strokeWidth="2" />
        {/* Glowing Rune Pillars */}
        <rect x="26" y="18" width="8" height="16" fill="#f2b738" />
        <rect x="206" y="18" width="8" height="16" fill="#42e88a" />
        {/* Crowned Boss Guardian & Adventurer */}
        <rect x="128" y="16" width="26" height="30" fill="#59283b" stroke="#120e1c" strokeWidth="2" />
        <rect x="132" y="10" width="18" height="6" fill="#f2b738" />
        <rect x="134" y="24" width="5" height="5" fill="#ff4d4d" />
        <rect x="143" y="24" width="5" height="5" fill="#ff4d4d" />
        {/* Adventurer & Slash Wave */}
        <rect x="74" y="24" width="16" height="22" fill="#3fa876" stroke="#120e1c" strokeWidth="2" />
        <path d="M 98 20 Q 116 32 98 44" stroke="#ffe18c" strokeWidth="3" fill="none" />
      </svg>
    );
  }
  if (modeId === 'fishing') {
    return (
      <svg
        viewBox="0 0 240 68"
        className="w-full h-20 rounded border border-[#225961] bg-[#091e24] mb-3"
        aria-hidden="true"
      >
        <rect width="240" height="36" fill="#1a4963" />
        <rect y="36" width="240" height="32" fill="#14638f" />
        <rect y="36" width="240" height="4" fill="#8de8ff" />
        {/* Island & Dock */}
        <rect x="14" y="26" width="54" height="12" fill="#d9b96b" />
        <rect x="20" y="22" width="42" height="5" fill="#4ec46a" />
        <rect x="64" y="30" width="28" height="4" fill="#8c5a32" />
        {/* Fishing Boat & Angler */}
        <polygon points="104,34 152,34 144,44 112,44" fill="#9e5a34" stroke="#121a24" strokeWidth="2" />
        <rect x="122" y="20" width="12" height="14" fill="#38a8eb" />
        <line x1="134" y1="22" x2="176" y2="12" stroke="#e8f4fa" strokeWidth="2" />
        <line x1="176" y1="12" x2="176" y2="38" stroke="#bfe8ff" strokeWidth="1.5" />
        <rect x="173" y="35" width="6" height="6" fill="#ff5242" />
        {/* Deep Fish Silhouettes */}
        <rect x="192" y="48" width="18" height="7" fill="#38e8d8" opacity="0.8" />
        <rect x="148" y="54" width="14" height="6" fill="#ffe18c" opacity="0.75" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 240 68"
      className="w-full h-20 rounded border border-[#285938] bg-[#0b1a11] mb-3"
      aria-hidden="true"
    >
      <rect width="240" height="68" fill="#18222e" />
      {/* Cavern Ceiling Stalactites & Strata */}
      <polygon points="24,0 34,22 44,0" fill="#2c3a4d" />
      <polygon points="108,0 120,26 132,0" fill="#2c3a4d" />
      <polygon points="188,0 198,18 208,0" fill="#2c3a4d" />
      <rect y="48" width="240" height="20" fill="#283342" />
      {/* Glowing Crystal & Ore Veins */}
      <rect x="44" y="30" width="18" height="18" fill="#4b4569" stroke="#10151f" strokeWidth="2" />
      <rect x="48" y="34" width="6" height="6" fill="#d7c8ff" />
      <rect x="54" y="40" width="5" height="5" fill="#7df5ff" />
      {/* Stone Furnace with Molten Core */}
      <rect x="164" y="24" width="26" height="24" fill="#5c6673" stroke="#10151f" strokeWidth="2" />
      <rect x="171" y="31" width="12" height="11" fill="#ff6824" />
      <rect x="174" y="34" width="6" height="7" fill="#ffe18c" />
      {/* Miner & Pickaxe */}
      <rect x="98" y="26" width="16" height="22" fill="#4ec46a" stroke="#10151f" strokeWidth="2" />
      <rect x="96" y="22" width="20" height="5" fill="#f2b738" />
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
  onOpenDungeons,
  onOpenFishing3d,
  onSignOut,
}) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#07101a]/95 p-3 sm:p-6">
    <main className="w-full max-w-4xl rounded-xl border-2 border-[#3b5978] bg-[#0f1d2c] p-4 sm:p-6 shadow-[0_12px_0_rgba(6,12,20,0.9)]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#28425e] pb-4">
        <div>
          <p className="font-pixel text-[10px] tracking-widest text-[#78c8f5]">ALTERBIT REALMS</p>
          <h1 className="mt-1 font-pixel text-lg text-[#fff8e8]">Choose Your Realm</h1>
          <p className="mt-1 text-xs font-mono-num text-[#b9d2e8]">
            {playerName} · Level {level} · {Math.round(gems)} Gems
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`text-xs font-bold ${
              connected ? 'text-[#8ef0a4]' : 'text-[#ffb0b0]'
            }`}
          >
            {connected ? 'Connected' : 'Reconnecting'}
          </span>
          {!connected && (
            <button
              type="button"
              onClick={onReconnectNow}
              className="rounded bg-[#213b57] px-3 py-1.5 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="rounded border border-[#80333a] bg-[#3b1b1f] hover:bg-[#4f2329] px-3.5 py-2 text-xs font-bold text-[#ffd4d4] cursor-pointer whitespace-nowrap"
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
            onClick={() =>
              mode.action === 'dungeon'
                ? onOpenDungeons()
                : mode.action === 'fishing_3d'
                  ? onOpenFishing3d()
                  : onEnterWorld(mode.worldName)
            }
            className={`group rounded-lg border-2 p-4 text-left shadow-[0_6px_0_rgba(6,12,20,0.85)] transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between ${mode.accent}`}
          >
            <div>
              <ModeArtwork modeId={mode.id} />
              <span className="font-pixel text-xs text-[#fff8e8] block">{mode.title}</span>
              <span className="mt-2 block text-sm font-semibold text-[#e6f1fa]">
                {mode.subtitle}
              </span>
              <span className="mt-1.5 block text-xs text-[#9cb5cc]">{mode.detail}</span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span
                className={`inline-block rounded border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap ${mode.ctaBg}`}
              >
                Enter Mode →
              </span>
            </div>
          </button>
        ))}
      </section>
      <p className="mt-4 text-center text-xs text-[#7d9bb8]">
        Your account is shared across all modes · Each realm preserves its own progression.
      </p>
    </main>
  </div>
);
