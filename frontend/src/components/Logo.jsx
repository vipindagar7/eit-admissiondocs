import { useState } from 'react';
import { cn } from '../lib/utils.js';
import logo from "../images/Black-Logo.webp"
/**
 * Renders the college logo from /logo.png (served from frontend/public/).
 * Falls back to a text monogram automatically if that file doesn't exist
 * yet or fails to load — so nothing breaks before the real asset is added.
 *
 * To use your real logo: put the image file at frontend/public/logo.png
 * (any of .png/.svg/.jpg works, just keep the filename "logo" + update
 * the src below if you use a different extension).
 */
export default function Logo({ className }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-700 font-bold text-white shadow-sm',
          className
        )}
      >
        <span className="tracking-tight">EIT</span>
      </div>
    );
  }

  return (
    <img
      src={logo}
      alt="EIT Faridabad"
      className={cn('object-contain', className)}
      onError={() => setImgFailed(true)}
    />
  );
}