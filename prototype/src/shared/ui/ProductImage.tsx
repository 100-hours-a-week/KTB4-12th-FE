import { useState } from 'react';

import { DEFAULT_PRODUCT_IMAGE } from '../config/assets';

export function ProductImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = src && failedSrc !== src ? src : DEFAULT_PRODUCT_IMAGE;
  return (
    <img
      className={className}
      src={imageSrc}
      alt={alt}
      draggable={false}
      onError={() => {
        if (imageSrc !== DEFAULT_PRODUCT_IMAGE) setFailedSrc(imageSrc);
      }}
    />
  );
}
