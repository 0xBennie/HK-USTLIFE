export function SourceBadge({ owner, freshness = 'official source' }: { owner: string; freshness?: string }) {
  return (
    <span className="source-badge">
      <span aria-hidden="true">●</span> {owner} · {freshness}
    </span>
  );
}
