import React from 'react';

interface RedGemIconProps {
  className?: string;
}

/**
 * Matches the in-world 10-unit Red Gem sprite texture (24x24 pixel-cut octagon).
 */
export const RedGemIcon: React.FC<RedGemIconProps> = ({ className = 'w-4 h-4 shrink-0' }) => (
  <svg
    viewBox="0 0 24 24"
    shapeRendering="crispEdges"
    className={className}
    aria-hidden="true"
  >
    {/* Outer dark pixel silhouette (#090d16) matching engine 10-unit gem */}
    <rect x="2" y="0" width="20" height="24" fill="#090d16" />
    <rect x="0" y="2" width="24" height="20" fill="#090d16" />
    <rect x="1" y="1" width="22" height="22" fill="#090d16" />

    {/* Deep crimson facet shadows (left & bottom) */}
    <rect x="1" y="3" width="6" height="18" fill="#991b1b" />
    <rect x="3" y="17" width="18" height="6" fill="#991b1b" />

    {/* Primary crimson gem body */}
    <rect x="7" y="1" width="15" height="20" fill="#dc2626" />
    <rect x="2" y="2" width="19" height="15" fill="#dc2626" />

    {/* Restore left dark-red shadow band over body edge */}
    <rect x="2" y="3" width="5" height="17" fill="#991b1b" />
    <rect x="3" y="18" width="18" height="4" fill="#991b1b" />

    {/* Brilliant crown highlight (top-right) */}
    <rect x="8" y="2" width="11" height="10" fill="#f87171" />

    {/* Sparkling top glint */}
    <rect x="10" y="2" width="3" height="3" fill="#fee2e2" />
    <rect x="11" y="2" width="2" height="2" fill="#ffffff" />

    {/* Re-ink outer 1px corners so bezel stays crisp at any scale */}
    <rect x="2" y="0" width="20" height="1" fill="#090d16" />
    <rect x="2" y="23" width="20" height="1" fill="#090d16" />
    <rect x="0" y="2" width="1" height="20" fill="#090d16" />
    <rect x="23" y="2" width="1" height="20" fill="#090d16" />
    <rect x="1" y="1" width="1" height="1" fill="#090d16" />
    <rect x="22" y="1" width="1" height="1" fill="#090d16" />
    <rect x="1" y="22" width="1" height="1" fill="#090d16" />
    <rect x="22" y="22" width="1" height="1" fill="#090d16" />
  </svg>
);
