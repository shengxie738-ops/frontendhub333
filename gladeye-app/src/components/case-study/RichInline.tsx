import type { RichNode, RichRun } from '@/content/schema';

/**
 * Inline-only renderer for ProseMirror docs that live *inside* a heading element.
 *
 * `RichText.tsx` emits the block-level `<div class="rich-text"><p>…</p></div>` the
 * original uses for body copy, but the case-study heading and the "Up Next" deck are
 * single-paragraph docs painted straight into an `<h2>` / `<h4>`:
 *
 *   <h2 class="t-d3 indent-20"><i>Futuristic GUI</i> for a post-apocalyptic metaverse</h2>
 *
 * so the runs are flattened here. Every captured `intro.headingDoc` and
 * `next.headingDoc` in projects.json is exactly one paragraph; anything else is joined
 * with `<br />` rather than dropped.
 */
function Runs({ runs }: { runs: RichRun[] }) {
  return (
    <>
      {runs.map((run, i) => {
        let node: React.ReactNode = run.text;
        if (run.c) node = <span style={{ color: run.c }} key={i}>{node}</span>;
        if (run.i) node = <i>{node}</i>;
        if (run.b) node = <b>{node}</b>;
        if (run.href)
          node = (
            <a className="ui-link" href={run.href} target={run.target || '_blank'} rel="nofollow noopener noreferrer">
              {node}
            </a>
          );
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}

export function RichInline({ nodes }: { nodes: RichNode[] }) {
  const parts: React.ReactNode[] = [];
  nodes.forEach((node, i) => {
    if (node.t === 'p') parts.push(<Runs key={i} runs={node.runs} />);
    else if (node.t === 'h') parts.push(<Runs key={i} runs={node.runs} />);
    else if (node.t === 'ul' || node.t === 'ol')
      parts.push(
        <span key={i}>
          {node.items.map((item, j) => (
            <span key={j}>
              {j > 0 ? <br /> : null}
              <Runs runs={item.runs} />
            </span>
          ))}
        </span>,
      );
    else if (node.t === 'inlineImage') parts.push(<img key={i} src={node.src} alt="" loading="lazy" />);
    else if (node.t !== 'hr') parts.push(<span key={i}>[unsupported rich node: {String((node as { t: string }).t)}]</span>);
    if (i < nodes.length - 1 && node.t !== 'hr' && nodes[i + 1] && nodes[i + 1].t !== 'hr') parts.push(<br key={`br-${i}`} />);
  });
  return <>{parts}</>;
}

export default RichInline;
