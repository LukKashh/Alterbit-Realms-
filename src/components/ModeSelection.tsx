import React from 'react';

interface ModeSelectionProps {
  playerName: string;
  level: number;
  gems: number;
  connected: boolean;
  onReconnectNow: () => void;
  onEnterWorld: (worldName: string) => void;
  onOpenDungeons: () => void;
  onSignOut: () => void;
}

const MODES = [
  { id: 'nexus', title: 'NEXUS REALMS', subtitle: 'Build, own and share your personal realms.', detail: 'Persistent sandbox worlds', accent: 'border-[#78c8f5] bg-[#13293d]', action: 'world' },
  { id: 'dungeons', title: 'DUNGEONS', subtitle: 'Enter third-person expeditions and defeat dungeon guardians.', detail: '3D combat adventures', accent: 'border-[#f2b738] bg-[#2b2112]', action: 'dungeon' },
  { id: 'fishing', title: 'FISCORE', subtitle: 'Explore the waters and master the fishing depths.', detail: 'Fishing and discovery', accent: 'border-[#38e8d8] bg-[#102a2e]', action: 'world' },
  { id: 'cave', title: 'CAVE DWELLER', subtitle: 'Descend through strata, mine ores and refine resources.', detail: 'Underground progression', accent: 'border-[#4ec46a] bg-[#132b1d]', action: 'world' },
] as const;

export const ModeSelection: React.FC<ModeSelectionProps> = ({
  playerName, level, gems, connected, onReconnectNow, onEnterWorld, onOpenDungeons, onSignOut,
}) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto bg-[#07101a]/95 p-3 sm:p-6">
    <main className="w-full max-w-4xl rounded-xl border-2 border-[#3b5978] bg-[#0f1d2c] p-4 sm:p-6 shadow-[0_12px_0_rgba(6,12,20,0.9)]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#28425e] pb-4">
        <div>
          <p className="font-pixel text-[10px] tracking-widest text-[#78c8f5]">ALTERBIT REALMS</p>
          <h1 className="mt-1 font-pixel text-lg text-[#fff8e8]">Choose Your Realm</h1>
          <p className="mt-1 text-xs text-[#9cb5cc]">{playerName} · Level {level} · {Math.round(gems)} Gems</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded border px-2 py-1 text-[10px] font-bold ${connected ? 'border-[#4ec46a] text-[#b7ffd7]' : 'border-[#b85b5b] text-[#ffb0b0]'}`}>
            {connected ? 'CONNECTED' : 'RECONNECTING'}
          </span>
          {!connected && <button type="button" onClick={onReconnectNow} className="rounded bg-[#213b57] px-2 py-1 text-xs text-white">Retry</button>}
          <button type="button" onClick={onSignOut} className="rounded border border-[#80333a] bg-[#3b1b1f] px-3 py-2 text-xs font-bold text-[#ffd4d4]">Sign Out</button>
        </div>
      </header>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODES.map((mode) => (
          <button key={mode.id} type="button" data-testid={`mode-${mode.id}`}
            onClick={() => mode.action === 'dungeon' ? onOpenDungeons() : onEnterWorld(mode.id === 'nexus' ? 'NEXUS' : mode.id === 'fishing' ? 'FISHING' : 'DWELLER')}
            className={`min-h-40 rounded-lg border-2 p-4 text-left transition hover:-translate-y-0.5 hover:brightness-110 ${mode.accent}`}>
            <span className="font-pixel text-xs text-[#fff8e8]">{mode.title}</span>
            <span className="mt-3 block text-sm font-semibold text-[#dceaf6]">{mode.subtitle}</span>
            <span className="mt-2 block text-[10px] uppercase tracking-wide text-[#89b2cf]">{mode.detail}</span>
            <span className="mt-4 inline-block rounded bg-black/20 px-3 py-1.5 text-xs font-bold text-white">Enter Mode →</span>
          </button>
        ))}
      </section>
      <p className="mt-4 text-center text-[10px] text-[#6d8ba8]">Your account is shared. Each mode maintains its own gameplay experience.</p>
    </main>
  </div>
);
