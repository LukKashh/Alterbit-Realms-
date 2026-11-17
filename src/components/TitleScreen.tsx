import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../game/audio.ts';

interface TitleScreenProps {
  onLogin: (identifier: string, password: string) => Promise<void>;
  onRegister: (email: string, username: string, password: string) => Promise<void>;
  errorMessage: string | null;
  submitting: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onLogin,
  onRegister,
  errorMessage,
  submitting,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.muted);

  const ensureMenuAudioPlaying = () => {
    soundEngine.unlock();
    soundEngine.startMenuTheme();
  };

  const handleToggleSound = () => {
    soundEngine.unlock();
    const nextMuted = !soundEngine.muted;
    soundEngine.muted = nextMuted;
    setMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.startMenuTheme();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    ensureMenuAudioPlaying();
    setLocalError(null);
    if (authTab === 'login') {
      if (!identifier.trim() || !password) {
        setLocalError('Enter your email or username and password.');
        return;
      }
      await onLogin(identifier.trim(), password);
    } else {
      if (!email.trim() || !username.trim() || !password) {
        setLocalError('Complete all profile registration fields.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      await onRegister(email.trim(), username.trim(), password);
    }
  };

  const displayError = localError || errorMessage;

  return (
    <div
      onPointerDown={ensureMenuAudioPlaying}
      onKeyDown={ensureMenuAudioPlaying}
      className="fixed inset-0 z-20 flex flex-col justify-center px-3 sm:px-6 py-4 pointer-events-none overflow-y-auto"
    >
      <div className="flex flex-col items-center gap-3.5 my-auto w-full">
        {/* Futuristic Sci-Fi Alteria Header & Pixel Cosmic Crest */}
        <svg
          viewBox="0 0 560 112"
          className="w-full max-w-[470px] h-auto drop-shadow-[0_6px_18px_rgba(56,189,248,0.32)]"
          role="img"
          aria-label="Alteria"
        >
          <defs>
            <linearGradient id="alteriaCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="alteriaTextGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="55%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#7dd3fc" />
            </linearGradient>
          </defs>

          {/* Cosmic Hex/Orbital Emblem */}
          <g transform="translate(16, 14)">
            {/* Outer Orbital Halo */}
            <ellipse
              cx="40"
              cy="40"
              rx="35"
              ry="13"
              transform="rotate(-22 40 40)"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeOpacity="0.72"
            />
            {/* Hexagonal Dark Space Chassis */}
            <polygon
              points="40,8 66,23 66,57 40,72 14,57 14,23"
              fill="#0b1330"
              stroke="#7dd3fc"
              strokeWidth="3.5"
            />
            {/* Inner Geometric Crystal 'A' Spire */}
            <polygon
              points="40,18 55,54 46,54 40,39 34,54 25,54"
              fill="url(#alteriaCoreGrad)"
            />
            <rect x="33" y="45" width="14" height="5" fill="#e0f2fe" />
            {/* Pixel Star Sparks */}
            <rect x="6" y="16" width="4" height="4" fill="#a5f3fc" />
            <rect x="70" y="18" width="5" height="5" fill="#c084fc" />
            <rect x="64" y="64" width="4" height="4" fill="#fde047" />
          </g>

          <text
            x="108"
            y="61"
            fill="url(#alteriaTextGrad)"
            stroke="#060c22"
            strokeWidth="9"
            paintOrder="stroke fill"
            fontFamily="'Silkscreen', 'Pixelify Sans', monospace"
            fontWeight="700"
            fontSize="50"
            letterSpacing="4"
          >
            ALTERIA
          </text>
          <text
            x="110"
            y="88"
            fill="#a5f3fc"
            stroke="#060c22"
            strokeWidth="5"
            paintOrder="stroke fill"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontWeight="800"
            fontSize="12.5"
            letterSpacing="2.4"
          >
            2D-MMO SANDBOX PLATFORMER CONCEPT
          </text>
        </svg>

        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto w-full max-w-[440px] alteria-login-box p-4 sm:p-5 flex flex-col gap-3.5"
        >
          {/* Card Header Strip + Sound Toggle */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-pixel uppercase tracking-[0.18em] text-[#7dd3fc]">
              Orbital Uplink Access
            </span>
            <button
              type="button"
              onClick={handleToggleSound}
              title={muted ? 'Unmute Login Soundtrack' : 'Mute Login Soundtrack'}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[7px] text-[10px] font-semibold bg-[#0f1c42]/90 border border-[#38bdf8]/45 text-[#bae6fd] hover:text-white hover:border-[#7dd3fc] cursor-pointer transition-colors"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-[#f87171]" /> : <Volume2 className="w-3.5 h-3.5 text-[#38bdf8]" />}
              <span>{muted ? 'Muted' : '28-bit OST'}</span>
            </button>
          </div>

          {/* Existing User Login vs New Profile Creation Tabs */}
          <div className="alteria-subpanel grid grid-cols-2 gap-1.5 p-1">
            <button
              type="button"
              onClick={() => {
                ensureMenuAudioPlaying();
                setAuthTab('login');
                setLocalError(null);
              }}
              className={`py-1.5 rounded-[7px] text-[11px] font-pixel cursor-pointer transition-all border ${
                authTab === 'login'
                  ? 'bg-[#0284c7]/35 border-[#38bdf8] text-[#f0f9ff] shadow-[0_0_12px_rgba(56,189,248,0.28)]'
                  : 'border-transparent text-[#94a3b8] hover:text-[#e0f2fe]'
              }`}
            >
              User Login
            </button>
            <button
              type="button"
              onClick={() => {
                ensureMenuAudioPlaying();
                setAuthTab('register');
                setLocalError(null);
              }}
              className={`py-1.5 rounded-[7px] text-[11px] font-pixel cursor-pointer transition-all border ${
                authTab === 'register'
                  ? 'bg-[#4f46e5]/40 border-[#818cf8] text-[#f0f9ff] shadow-[0_0_12px_rgba(129,140,248,0.28)]'
                  : 'border-transparent text-[#94a3b8] hover:text-[#e0f2fe]'
              }`}
            >
              New Profile
            </button>
          </div>

          {authTab === 'login' ? (
            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#bae6fd]">
                <span>Email or Username</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or username"
                  className="alteria-input px-3 py-2 text-sm font-semibold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#bae6fd]">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="alteria-input px-3 py-2 text-sm font-semibold"
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#bae6fd]">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="alteria-input px-2.5 py-1.5 text-sm font-semibold"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#bae6fd]">
                  <span>Username</span>
                  <input
                    type="text"
                    maxLength={16}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Explorer"
                    className="alteria-input px-2.5 py-1.5 text-sm font-semibold"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#bae6fd]">
                  <span>Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="alteria-input px-2.5 py-1.5 text-sm font-semibold"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#bae6fd]">
                  <span>Confirm Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="alteria-input px-2.5 py-1.5 text-sm font-semibold"
                  />
                </label>
              </div>
              <p className="text-[11px] text-[#94a3b8]">
                New explorers deploy with Builder Fist &amp; Tinker Wrench in their backpack.
              </p>
            </div>
          )}

          {displayError && (
            <div
              role="alert"
              className="rounded-[8px] text-xs font-semibold text-[#fecaca] bg-[#7f1d1d]/75 border border-[#f87171]/75 px-2.5 py-1.5"
            >
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-start="true"
            className="alteria-cta-btn w-full py-2.5 text-sm disabled:opacity-50 whitespace-nowrap"
          >
            {submitting
              ? 'Connecting to Alteria...'
              : authTab === 'login'
                ? 'Log In to Alteria'
                : 'Create Profile & Launch'}
          </button>
        </form>
      </div>
    </div>
  );
};

