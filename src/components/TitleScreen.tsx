import React, { useState } from 'react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="fixed inset-0 z-20 flex flex-col justify-between px-3 sm:px-6 py-3 pointer-events-none overflow-y-auto">
      <div className="flex flex-col items-center gap-3 pt-1 sm:pt-2 my-auto w-full">
        <svg
          viewBox="0 0 520 100"
          className="w-full max-w-[420px] h-auto drop-shadow-[0_4px_0_rgba(12,24,38,0.85)]"
          role="img"
          aria-label="Blockgrove"
        >
          <g transform="translate(18, 12)">
            <rect x="4" y="8" width="56" height="56" fill="#23374d" stroke="#0d1824" strokeWidth="4" />
            <rect x="8" y="12" width="48" height="16" fill="#4aa64d" />
            <rect x="8" y="12" width="48" height="6" fill="#82e068" />
            <rect x="8" y="28" width="48" height="32" fill="#7d5133" />
            <rect x="24" y="34" width="16" height="20" fill="#f2b738" />
            <rect x="28" y="38" width="8" height="6" fill="#fff0a8" />
            <rect x="30" y="46" width="4" height="6" fill="#4f3206" />
          </g>
          <text
            x="96"
            y="55"
            fill="#fff8e8"
            stroke="#0e1b29"
            strokeWidth="8"
            paintOrder="stroke fill"
            fontFamily="'Silkscreen', monospace"
            fontWeight="700"
            fontSize="44"
            letterSpacing="2"
          >
            BLOCKGROVE
          </text>
          <text
            x="98"
            y="82"
            fill="#ffe18c"
            stroke="#0e1b29"
            strokeWidth="5"
            paintOrder="stroke fill"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontWeight="700"
            fontSize="14"
            letterSpacing="3"
          >
            PERSISTENT 2D SANDBOX WORLDS
          </text>
        </svg>

        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto w-full max-w-[440px] pixel-wood-box p-4 flex flex-col gap-3"
        >
          {/* Existing User Login vs New Profile Creation Tabs */}
          <div className="hud-subpanel grid grid-cols-2 gap-1.5 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setLocalError(null);
              }}
              className={`py-1.5 rounded-[7px] text-[11px] font-pixel cursor-pointer transition-colors border-2 ${
                authTab === 'login'
                  ? 'bg-white/90 border-[#0284c7] text-[#091e3a]'
                  : 'border-transparent text-[#23476d] hover:text-[#091e3a]'
              }`}
            >
              User Login
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
                setLocalError(null);
              }}
              className={`py-1.5 rounded-[7px] text-[11px] font-pixel cursor-pointer transition-colors border-2 ${
                authTab === 'register'
                  ? 'bg-white/90 border-[#047857] text-[#091e3a]'
                  : 'border-transparent text-[#23476d] hover:text-[#091e3a]'
              }`}
            >
              New Profile
            </button>
          </div>

          {authTab === 'login' ? (
            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#091e3a]">
                <span>Email or Username</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or username"
                  className="hud-input px-2.5 py-2 text-sm font-semibold"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#091e3a]">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="hud-input px-2.5 py-2 text-sm font-semibold"
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#091e3a]">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="hud-input px-2.5 py-1.5 text-sm font-semibold focus:!border-[#047857]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#091e3a]">
                  <span>Username</span>
                  <input
                    type="text"
                    maxLength={16}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Explorer"
                    className="hud-input px-2.5 py-1.5 text-sm font-semibold focus:!border-[#047857]"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#091e3a]">
                  <span>Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="hud-input px-2.5 py-1.5 text-sm font-semibold focus:!border-[#047857]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#091e3a]">
                  <span>Confirm Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="hud-input px-2.5 py-1.5 text-sm font-semibold focus:!border-[#047857]"
                  />
                </label>
              </div>
              <p className="text-[11px] text-[#23476d]">
                New explorers begin with Builder Fist &amp; Tinker Wrench in their backpack.
              </p>
            </div>
          )}

          {displayError && (
            <div
              role="alert"
              className="rounded-[8px] text-xs font-semibold text-[#991b1b] bg-[#fee2e2]/90 border-2 border-[#dc2626] px-2.5 py-1.5"
            >
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-start="true"
            className="pixel-btn pixel-btn-emerald w-full !py-2.5 !text-sm disabled:opacity-50 whitespace-nowrap"
          >
            {submitting
              ? 'Authenticating...'
              : authTab === 'login'
                ? 'Log In to World Hub'
                : 'Create Profile & Enter Hub'}
          </button>
        </form>
      </div>

      <div className="flex justify-center pt-2">
        <p className="pixel-box !rounded-[9px] text-[11px] sm:text-xs font-semibold text-[#091e3a] px-3 py-1 text-center max-w-full">
          A/D or Arrows Move · W/Space Jump · Tap &amp; Hold Drag to Break/Place · 1–5 Hotbar
        </p>
      </div>
    </div>
  );
};
