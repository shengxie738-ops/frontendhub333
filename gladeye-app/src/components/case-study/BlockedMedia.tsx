/**
 * A media slot the origin cannot serve.
 *
 * Rendered as an explicit, labelled frame — never as a substituted, generated or
 * blurred-stand-in image. The clone's asset policy (`placeholdersUsed: false` in
 * `evidence/asset-report-work.json`) says an unavailable asset stays unavailable, so the
 * page has to say so out loud instead of hiding it behind a colour block.
 */
export function BlockedMedia({
  asset,
  reason,
  label = 'ASSET BLOCKED — not available from the origin',
}: {
  /** local public path / CMS url of what should have been here */
  asset?: string | null;
  reason?: string;
  label?: string;
}) {
  return (
    <div
      {...(asset ? { 'data-blocked-asset': asset } : {})}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.35rem',
        padding: '1rem',
        textAlign: 'center',
        border: '2px dashed #FF0000',
        color: '#FF0000',
        background: 'rgb(255 255 255 / 0.72)',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.72rem',
        lineHeight: 1.45,
      }}
    >
      <strong>{label}</strong>
      {asset ? <span>{asset}</span> : null}
      {reason ? <span>{reason}</span> : null}
    </div>
  );
}

export default BlockedMedia;
