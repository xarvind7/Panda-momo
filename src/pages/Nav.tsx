import {
  ArrowRight,
  BarChart3,
  Flame,
  LayoutGrid,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { BRAND } from '../data';
import { useSyncMeta } from '../store';
import { Logo, ThemeAndSoundControls } from '../ui';

type RouteKey = 'staff' | 'kitchen' | 'owner' | 'admin';

const LINKS: Array<{
  key: RouteKey;
  href: string;
  label: string;
  Icon: typeof LayoutGrid;
}> = [
  { key: 'staff', href: '#/staff', label: 'Floor', Icon: LayoutGrid },
  { key: 'kitchen', href: '#/kitchen', label: 'Kitchen', Icon: Flame },
  { key: 'owner', href: '#/owner', label: 'Reports', Icon: BarChart3 },
  { key: 'admin', href: '#/admin', label: 'Admin', Icon: ShieldCheck },
];

export default function Nav({ active }: { active: RouteKey }) {
  const syncMeta = useSyncMeta();

  return (
    <header className="top-nav noprint">
      <a href="#/" className="top-nav-brand" aria-label="Panda Momo Home">
        <Logo size={32} />
        <span>{BRAND}</span>
      </a>

      <nav className="top-nav-links" aria-label="Staff navigation">
        {LINKS.map(({ key, href, label, Icon }) => (
          <a
            key={key}
            href={href}
            aria-current={active === key ? 'page' : undefined}
            className={`nav-link ${active === key ? 'active' : ''}`}
          >
            <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <div className="top-nav-cta">
        <ThemeAndSoundControls />
        <span
          className={`nav-sync-status ${syncMeta.connected ? 'is-live' : 'is-reconnecting'}`}
          title={
            syncMeta.supabase?.connected
              ? `Supabase Cloud (${syncMeta.supabase.projectRef}) + Real-time Live (Rev #${syncMeta.rev})`
              : syncMeta.connected
                ? `Real-time server connected (Rev #${syncMeta.rev})`
                : 'Connecting to real-time stream'
          }
        >
          <span className="nav-sync-dot" aria-hidden="true" />
          <span>
            {syncMeta.supabase?.connected
              ? 'Supabase Live'
              : syncMeta.connected
                ? 'Live'
                : 'Sync'}
          </span>
        </span>
        <a href="#/m" className="nav-cta-btn">
          <UtensilsCrossed size={14} strokeWidth={2.2} aria-hidden="true" />
          <span>Guest menu</span>
          <ArrowRight size={14} strokeWidth={2.3} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
