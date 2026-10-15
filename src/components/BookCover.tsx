import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen } from 'lucide-react';
import { db } from '../services/db';
import { useObjectUrl } from '../hooks/useObjectUrl';
export function BookCover({
  title,
  coverId,
  coverUrl,
  preview,
  eager = false,
}: {
  title: string;
  coverId?: string;
  coverUrl?: string;
  preview?: Blob | null;
  eager?: boolean;
}) {
  const asset = useLiveQuery(
    async () => (coverId && !preview ? await db.covers.get(coverId).catch(() => null) : null),
    [coverId, preview],
  );
  const objectUrl = useObjectUrl(preview ?? asset?.blob);
  const external = coverUrl && /^https?:\/\//i.test(coverUrl) ? coverUrl : undefined;
  const src = preview || coverId ? objectUrl : external;
  const [failed, setFailed] = useState<string>();
  const [loaded, setLoaded] = useState<string>();
  const waiting = !!(preview || coverId) && !src && asset === undefined;
  return (
    <div className={`book-cover ${src && failed !== src ? 'has-image' : ''}`}>
      <div className="book-cover-placeholder" aria-hidden="true">
        <BookOpen size={35} strokeWidth={1.2} />
        <span>NEXUS · BIBLIOTECA</span>
      </div>
      {src && failed !== src && (
        <img
          src={src}
          alt={`Capa de ${title}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          className={loaded === src ? 'loaded' : ''}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
        />
      )}
      {!src || failed === src ? (
        <span className="cover-caption">
          {waiting ? 'Carregando capa…' : failed === src && src ? 'Capa indisponível' : 'Sem capa'}
        </span>
      ) : loaded !== src ? (
        <span className="cover-caption" role="status">
          Carregando capa…
        </span>
      ) : null}
    </div>
  );
}
