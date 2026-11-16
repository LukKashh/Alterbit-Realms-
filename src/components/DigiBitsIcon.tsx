import React from 'react';

export const DIGIBITS_ICON_SRC =
  '/assets/aistudio/file_000000007cac8246a758fd2b7857df24_56dec2a9.png';

interface DigiBitsIconProps {
  className?: string;
  alt?: string;
}

/**
 * Renders the coin-shape cutout DigiBits currency emblem sized to fit any HUD context.
 */
export const DigiBitsIcon: React.FC<DigiBitsIconProps> = ({
  className = 'w-4 h-4 shrink-0',
  alt = 'DigiBits',
}) => (
  <img
    src={DIGIBITS_ICON_SRC}
    alt={alt}
    aria-hidden="true"
    draggable={false}
    referrerPolicy="no-referrer"
    className={`inline-block object-contain pixelated select-none pointer-events-none ${className}`}
  />
);
