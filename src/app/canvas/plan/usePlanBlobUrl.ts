// usePlanBlobUrl — M5 render hook. Given a FloorBackground, returns the
// best URL the SVG <image> tag can render with:
//
//   1. If `blobHash` is set, look the blob up in IndexedDB, create a
//      fresh object URL for the session, and revoke it on cleanup.
//   2. Otherwise fall through to the legacy `dataUrl` (or null).
//
// This keeps the new pipeline working alongside any older floor data
// still carrying base64 in the persisted store. Subsequent migrations
// can move old dataUrl-only floors into IDB; until then this hook
// guarantees both shapes render.

import { useEffect, useState } from 'react';
import type { FloorBackground } from '../../store/types';
import { getPlanBlob } from './planStorage';

export function usePlanBlobUrl(background: FloorBackground | undefined | null): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function resolve() {
      if (!background) {
        if (!cancelled) setResolvedUrl(null);
        return;
      }
      // Prefer the IDB-backed blob if a hash is present.
      if (background.blobHash) {
        try {
          const blob = await getPlanBlob(background.blobHash);
          if (cancelled) return;
          if (blob) {
            createdUrl = URL.createObjectURL(blob);
            setResolvedUrl(createdUrl);
            return;
          }
        } catch (e) {
          // Fall through to dataUrl if IDB read failed (e.g. private
          // browsing). Better to render the old base64 than nothing.
          console.warn('usePlanBlobUrl: IDB read failed', e);
        }
      }
      // Legacy fallback.
      if (background.dataUrl) {
        if (!cancelled) setResolvedUrl(background.dataUrl);
        return;
      }
      if (!cancelled) setResolvedUrl(null);
    }
    resolve();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [background?.blobHash, background?.dataUrl]);

  return resolvedUrl;
}
