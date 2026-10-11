import React from 'react';

interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Image URL — when empty/blank, the fallback renders instead of `<img src="">`. */
  src?: string | null;
  /** Rendered when there is no usable src (defaults to nothing). */
  fallback?: React.ReactNode;
}

/**
 * Image that never renders `<img src="">` (which makes the browser
 * re-download the whole page and logs a React warning). Shows `fallback`
 * — e.g. an initials avatar — whenever the URL is missing or blank.
 */
export const SafeImage: React.FC<SafeImageProps> = ({ src, fallback = null, alt = '', ...rest }) => {
  if (!src || !src.trim()) return <>{fallback}</>;
  return <img src={src} alt={alt} {...rest} />;
};
