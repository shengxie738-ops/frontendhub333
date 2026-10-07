import type { InlineNode, RichLine } from '@/content/pages-schema';

/**
 * Renders an `InlineNode[]` exactly as the frozen DOM did:
 *   <br />          for hard breaks
 *   <i>             for italic runs   (Epicene serif, via `.rich-text i`)
 *   <b>             for bold runs
 *   <span style>    for the coloured em-dashes the CMS stores as textStyle marks
 *   <a>             for links
 *   <span>          for emoji nodes (the source renders the glyph, not an <img>)
 *
 * Text is never trimmed, re-cased or normalised — the source has intentional
 * trailing spaces ("Digital ", "Let's make it ").
 */
export function RichInline({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case 'br':
            return <br key={i} />;
          case 'i':
            return <i key={i}>{n.v}</i>;
          case 'b':
            return <b key={i}>{n.v}</b>;
          case 'span':
            return (
              <span key={i} style={{ color: n.color }}>
                {n.v}
              </span>
            );
          case 'emoji':
            return (
              <span key={i} data-type='emoji' data-name={n.name}>
                {n.v}
              </span>
            );
          case 'a': {
            const external = /^https?:/.test(n.href);
            return (
              <a
                key={i}
                href={n.href}
                {...(n.target ? { target: n.target } : {})}
                {...(external ? { rel: 'noopener noreferrer' } : {})}
              >
                {n.v}
              </a>
            );
          }
          case 'text':
          default:
            return <span key={i}>{n.v}</span>;
        }
      })}
    </>
  );
}

/**
 * Body copy of the two `page_bloks_content` sections and of `/careers`.
 *
 * In the frozen payload each `columns` / `body` entry is one paragraph, stored
 * as its ordered `InlineNode[]` — which is exactly what the shipped DOM emits:
 * one `<p class="break-inside-avoid-column">` per entry inside the two-column
 * `sm:columns-2` container. An entry with no nodes (the empty paragraph at the
 * tail of "Our process") emitted no `<p>` on the source, so it renders nothing
 * here too.
 */
export function RichColumn({ nodes, className }: { nodes: RichLine; className?: string }) {
  if (nodes.length === 0) return null;
  if (className) return <span className={className}><RichInline nodes={nodes} /></span>;
  return <RichInline nodes={nodes} />;
}
