import Link from 'next/link';

export function EmptyState({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: { label: string; href: string } }) {
  return <section className="empty-state"><div className="empty-state-icon">✦</div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="empty-state-description">{description}</p>{action && <Link className="button button-small" href={action.href}>{action.label} <span>↗</span></Link>}<span className="empty-state-badge">Coming next</span></section>;
}
