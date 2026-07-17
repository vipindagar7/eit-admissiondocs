import { useState } from 'react';
import logo from "../images/Black-Logo.webp"

/**
 * Large, faint background watermark of the college logo. Purely
 * decorative (aria-hidden, pointer-events-none) and renders nothing at
 * all if /logo.png hasn't been added yet — no fallback text shown here,
 * since a giant faded "EIT" placeholder would look like a bug rather
 * than a watermark.
 */
export default function LogoWatermark() {
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <img
      src={logo}
      alt=""
      aria-hidden="true"
      onLoad={() => setVisible(true)}
      onError={() => setFailed(true)}
      className={`pointer-events-none fixed left-1/2 top-1/2 h-[65vmin] w-[65vmin] -translate-x-1/2 -translate-y-1/2 object-contain opacity-0 transition-opacity duration-700 ${
        visible ? 'opacity-[0.4]' : ''
      }`}
    />
  );
}