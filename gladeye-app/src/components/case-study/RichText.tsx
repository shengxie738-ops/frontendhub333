import type { RichNode, RichRun } from '@/content/schema';

/**
 * Compile-time proof that this renderer covers every `RichNode` discriminant. `node`
 * cannot be narrowed to `never` by the if-chain above (one union member carries the
 * `t: 'ul' | 'ol'` pair), so the exhaustiveness check is made on the discriminant set
 * itself: adding a node type to `schema.ts` without handling it here is a type error.
 */
type HandledRichNode = 'p' | 'ul' | 'ol' | 'h' | 'hr' | 'inlineImage';
const _richNodeTypesHandled: Exclude<RichNode['t'], HandledRichNode> extends never ? true : never = true;
void _richNodeTypesHandled;

/**
 * Storyblok ProseMirror documents are rendered node-for-node with the CMS's own inline
 * marks (bold / italic / colour / link), exactly as the original `rich-text` markup does:
 *   <p><span style="color:#36393C">…</span><i><span style="color:#36393C">…</span></i></p>
 */
function Run({ run }: { run: RichRun }) {
  let node: React.ReactNode = run.text;
  if (run.c) node = <span style={{ color: run.c }}>{node}</span>;
  if (run.i) node = <i>{node}</i>;
  if (run.b) node = <b>{node}</b>;
  if (run.href)
    node = (
      <a
        className="ui-link"
        href={run.href}
        target={run.target || '_blank'}
        rel="nofollow noopener noreferrer"
      >
        {node}
      </a>
    );
  return <>{node}</>;
}

export default function RichText({ nodes, className = '' }: { nodes: RichNode[]; className?: string }) {
  return (
    <div className={`rich-text ${className}`.trim()}>
      {nodes.map((node, i) => {
        if (node.t === 'p')
          return (
            <p key={i}>
              {node.runs.map((r, j) => (
                <Run key={j} run={r} />
              ))}
            </p>
          );
        if (node.t === 'ul' || node.t === 'ol') {
          const List = node.t === 'ul' ? 'ul' : 'ol';
          return (
            <List key={i}>
              {node.items.map((item, j) => (
                <li key={j}>
                  {item.runs.map((r, k) => (
                    <Run key={k} run={r} />
                  ))}
                </li>
              ))}
            </List>
          );
        }
        if (node.t === 'h') {
          const Tag = `h${Math.min(6, Math.max(2, node.level))}` as 'h2';
          return (
            <Tag key={i}>
              {node.runs.map((r, j) => (
                <Run key={j} run={r} />
              ))}
            </Tag>
          );
        }
        if (node.t === 'hr') return <hr key={i} />;
        if (node.t === 'inlineImage') return <img key={i} src={node.src} alt="" loading="lazy" decoding="async" />;
        // Loud, never silent: an unhandled node type must show up on the page.
        return (
          <p key={i} className="text-[#FF0000]">
            UNRENDERED RICH NODE: {String((node as { t?: string }).t ?? 'undefined')}
          </p>
        );
      })}
    </div>
  );
}
