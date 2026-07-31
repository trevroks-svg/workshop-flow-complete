import React from 'react';
import { useSignedStorageUrl } from '@/hooks/useSignedStorageUrls';

export default function PrivateStorageLink({
  objectPath,
  children,
  onClick,
  className,
  title,
}) {
  const { data: signedUrl, isLoading } = useSignedStorageUrl(objectPath);

  return (
    <a
      href={signedUrl || undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={!signedUrl}
      title={title}
      onClick={(event) => {
        onClick?.(event);
        if (!signedUrl) event.preventDefault();
      }}
      className={`${className || ''} ${isLoading ? 'opacity-60 cursor-wait' : ''}`.trim()}
    >
      {children}
    </a>
  );
}
