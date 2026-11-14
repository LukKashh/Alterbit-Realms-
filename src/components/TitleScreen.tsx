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
          <div className="grid grid-cols-2 gap-1.5 bg-[#090e17] p-1 border-2 border-[#1c2b3d]">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setLocalError(null);
              }}
              className={`py-1.5 text-[11px] font-pixel cursor-pointer transition-colors border-2 ${
                authTab === 'login'
                  ? 'bg-[#17334a] border-[#78c8f5] text-[#fff8e8]'
                  : 'border-transparent text-[#9cb5cc] hover:text-white'
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
              className={`py-1.5 text-[11px] font-pixel cursor-pointer transition-colors border-2 ${
                authTab === 'register'
                  ? 'bg-[#143322] border-[#82e068] text-[#fff8e8]'
                  : 'border-transparent text-[#9cb5cc] hover:text-white'
              }`}
            >
              New Profile
            </button>
          </div>

          {authTab === 'login' ? (
            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#fef3c7]">
                <span>Email or Username</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Enter email or username"
                  className="px-2.5 py-2 bg-[#05080e] border-2 border-[#1c2b3d] text-sm font-semibold text-[#f8f5ec] focus:outline-none focus:border-[#facc15]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[#fef3c7]">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="px-2.5 py-2 bg-[#05080e] border-2 border-[#1c2b3d] text-sm font-semibold text-[#f8f5ec] focus:outline-none focus:border-[#facc15]"
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#fef3c7]">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="px-2.5 py-1.5 bg-[#05080e] border-2 border-[#1c2b3d] text-sm font-semibold text-[#f8f5ec] focus:outline-none focus:border-[#82e068]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#fef3c7]">
                  <span>Username</span>
                  <input
                    type="text"
                    maxLength={16}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Explorer"
                    className="px-2.5 py-1.5 bg-[#05080e] border-2 border-[#1c2b3d] text-sm font-semibold text-[#f8f5ec] focus:outline-none focus:border-[#82e068]"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#fef3c7]">
                  <span>Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="px-2.5 py-1.5 bg-[#05080e] border-2 border-[#1c2b3d] text-sm font-semibold text-[#f8f5ec] focus:outline-none focus:border-[#82e068]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#fef3c7]">
                  <span>Confirm Password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="px-2.5 py-1.5 bg-[#05080e] border-2 border-[#1c2b3d] text-sm font-semibold text-[#f8f5ec] focus:outline-none focus:border-[#82e068]"
                  />
                </label>
              </div>
              <p className="text-[11px] text-[#e7d4b5]">
                New explorers begin with Builder Fist &amp; Tinker Wrench in their backpack.
              </p>
            </div>
          )}

          {displayError && (
            <div
              role="alert"
              className="text-xs font-semibold text-[#ff9b9b] bg-[#3b151a] border-2 border-[#7a2e38] px-2.5 py-1.5"
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
        <p className="text-[11px] sm:text-xs font-semibold text-[#0d1c2b] bg-[#e6f5ff]/88 px-3 py-1 rounded text-center max-w-full">
          A/D or Arrows Move · W/Space Jump · Tap &amp; Hold Drag to Break/Place · 1–6 Hotbar
        </p>
      </div>
    </div>
  );
};
