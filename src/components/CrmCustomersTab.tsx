import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  Phone,
  Plus,
  Save,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  byId,
  fmt,
  orderTotal,
  shortId,
  type State,
} from '../data';
import {
  buildCustomerInsights,
  buildWhatsAppMessageUrl,
  computeCrmSummary,
  customersToCsv,
  filterAndSortCustomers,
  formatRelativeVisit,
  PRESET_CRM_TAGS,
  type CustomerInsight,
  type CustomerSegmentFilter,
  type CustomerSortKey,
} from '../crm';
import {
  addCustomerManual,
  adjustCustomerPoints,
  deleteCustomerRecord,
  recordCustomerVisit,
  updateCustomerProfile,
} from '../store';
import { showSakugaToast } from '../sakuga';

interface CrmCustomersTabProps {
  state: State;
  now: number;
  initialSelectedPhone?: string | null;
  onClearInitialSelected?: () => void;
  initialOpenAddModal?: boolean;
  onClearInitialAddModal?: () => void;
  onRequestConfirm: (opts: {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) => void;
}

export default function CrmCustomersTab({
  state,
  now,
  initialSelectedPhone,
  onClearInitialSelected,
  initialOpenAddModal,
  onClearInitialAddModal,
  onRequestConfirm,
}: CrmCustomersTabProps) {
  const [segment, setSegment] = useState<CustomerSegmentFilter>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<CustomerSortKey>('recent');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(initialSelectedPhone || null);
  const [showAddModal, setShowAddModal] = useState<boolean>(Boolean(initialOpenAddModal));

  // Add customer form state
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPoints, setAddPoints] = useState('25');
  const [addBirthday, setAddBirthday] = useState('');
  const [addTags, setAddTags] = useState<string[]>(['Regular']);
  const [addNotes, setAddNotes] = useState('');
  const [addErr, setAddErr] = useState('');

  // Drawer editable fields
  const [editNotes, setEditNotes] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [customTagInput, setCustomTagInput] = useState('');

  useEffect(() => {
    if (initialSelectedPhone) {
      setSelectedPhone(initialSelectedPhone);
      onClearInitialSelected?.();
    }
  }, [initialSelectedPhone, onClearInitialSelected]);

  useEffect(() => {
    if (initialOpenAddModal) {
      setShowAddModal(true);
      onClearInitialAddModal?.();
    }
  }, [initialOpenAddModal, onClearInitialAddModal]);

  const insights = useMemo(
    () => buildCustomerInsights(state.customers || [], state.orders, state.menu, now),
    [state.customers, state.orders, state.menu, now]
  );

  const summary = useMemo(() => computeCrmSummary(insights), [insights]);

  const filtered = useMemo(
    () => filterAndSortCustomers(insights, segment, search, sortBy),
    [insights, segment, search, sortBy]
  );

  const selectedInsight: CustomerInsight | null = useMemo(
    () => (selectedPhone ? insights.find((i) => i.customer.phone === selectedPhone) || null : null),
    [insights, selectedPhone]
  );

  const activePromo = useMemo(
    () => (state.promos || []).find((p) => p.active) || null,
    [state.promos]
  );

  useEffect(() => {
    if (!selectedInsight) return;
    setEditNotes(selectedInsight.notes);
    setEditBirthday(selectedInsight.birthday);
    setCustomTagInput('');
  }, [selectedInsight?.customer.phone]);

  useEffect(() => {
    if (!selectedPhone && !showAddModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddModal) setShowAddModal(false);
        else if (selectedPhone) setSelectedPhone(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPhone, showAddModal]);

  function handleExportCsv() {
    if (filtered.length === 0) {
      showSakugaToast('Export karne ke liye koi customer nahi hai.', 'gold', 'EMPTY');
      return;
    }
    try {
      const csv = customersToCsv(filtered);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `panda-momo-crm-customers.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSakugaToast(`${filtered.length} customers CSV export ho gaya!`, 'green', 'CSV!');
    } catch {
      showSakugaToast('CSV download nahi ho paya.', 'red', 'ERR');
    }
  }

  function handleAddCustomerSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = addCustomerManual({
      name: addName,
      phone: addPhone,
      tags: addTags,
      notes: addNotes,
      birthday: addBirthday,
      loyaltyPoints: Number(addPoints) || 0,
    });
    if (!res.ok) {
      setAddErr(res.error);
      return;
    }
    setAddErr('');
    setAddName('');
    setAddPhone('');
    setAddPoints('25');
    setAddBirthday('');
    setAddTags(['Regular']);
    setAddNotes('');
    setShowAddModal(false);
    setSelectedPhone(res.customer.phone);
    showSakugaToast(`${res.customer.name} CRM mein add ho gaya!`, 'green', 'SAVED!');
  }

  function toggleTagForSelected(tag: string) {
    if (!selectedInsight) return;
    const exists = selectedInsight.tags.includes(tag);
    const nextTags = exists
      ? selectedInsight.tags.filter((t) => t !== tag)
      : [...selectedInsight.tags, tag];
    updateCustomerProfile(selectedInsight.customer.phone, { tags: nextTags });
  }

  function handleAddCustomTag(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInsight) return;
    const clean = customTagInput.trim();
    if (!clean) return;
    if (!selectedInsight.tags.includes(clean)) {
      updateCustomerProfile(selectedInsight.customer.phone, {
        tags: [...selectedInsight.tags, clean],
      });
    }
    setCustomTagInput('');
  }

  function handleSaveDrawerProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInsight) return;
    updateCustomerProfile(selectedInsight.customer.phone, {
      notes: editNotes,
      birthday: editBirthday,
    });
    showSakugaToast(`${selectedInsight.customer.name} ka profile update ho gaya!`, 'green', 'SAVED!');
  }

  const segments: Array<{ id: CustomerSegmentFilter; label: string; count: number }> = [
    { id: 'all', label: 'Sab Guests', count: summary.totalCustomers },
    { id: 'vip', label: 'VIP', count: summary.vipCount },
    { id: 'regular', label: 'Regular', count: summary.regularCount },
    { id: 'new', label: 'New', count: summary.newCount },
    { id: 'dormant', label: 'Follow-up', count: summary.dormantCount },
  ];

  return (
    <div className="crm-stack">
      {/* Header Toolbar */}
      <div className="crm-section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="crm-hero-title icon-heading" style={{ fontSize: 24 }}>
            <Users size={22} strokeWidth={2.2} style={{ color: 'var(--gold)' }} aria-hidden="true" />
            <span>Customer CRM</span>
          </h1>
          <p className="dark-sub">
            Guest profiles, lifetime spend, loyalty points aur 1-tap WhatsApp outreach
          </p>
        </div>
        <div className="crm-quick-actions">
          <button type="button" className="btn-ghost-dark" onClick={handleExportCsv}>
            <Download size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setAddErr('');
              setShowAddModal(true);
            }}
          >
            <UserPlus size={14} strokeWidth={2.2} aria-hidden="true" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* 4-Column CRM KPI Summary */}
      <section className="crm-kpi-grid" aria-label="Customer CRM KPIs">
        <div className="kpi-card">
          <div className="kpi-head-row">
            <span className="kpi-label">Total Guests</span>
            <span className="crm-kpi-tag crm-tone-blue">{summary.newCount} New</span>
          </div>
          <div className="kpi-val tabular-nums">{summary.totalCustomers}</div>
          <div className="kpi-sub tabular-nums">QR scans &amp; walk-in records</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head-row">
            <span className="kpi-label">Repeat Rate</span>
            <span className="crm-kpi-tag crm-tone-green">{summary.vipCount} VIP</span>
          </div>
          <div className="kpi-val tabular-nums">{summary.repeatRatePct}%</div>
          <div className="kpi-sub tabular-nums">
            {summary.regularCount} Regular · {summary.dormantCount} Follow-up
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head-row">
            <span className="kpi-label">Tracked Spend</span>
            <span className="crm-kpi-tag crm-tone-gold">LTV</span>
          </div>
          <div className="kpi-val tabular-nums">{fmt(summary.totalTrackedRevenue)}</div>
          <div className="kpi-sub tabular-nums">Avg {fmt(summary.avgCustomerLtv)} / guest</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-head-row">
            <span className="kpi-label">Loyalty Pool</span>
            <span className="crm-kpi-tag crm-tone-gold">Rewards</span>
          </div>
          <div className="kpi-val tabular-nums">{summary.totalLoyaltyPoints.toLocaleString('en-IN')}</div>
          <div className="kpi-sub">1 pt per ₹10 bill settled</div>
        </div>
      </section>

      {/* Filter, Search & Sort Controls */}
      <section className="d-card crm-directory-card" aria-label="Customer directory">
        <div className="crm-filter-bar">
          <div className="crm-seg-group" role="tablist" aria-label="Customer segments">
            {segments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                role="tab"
                aria-selected={segment === seg.id}
                className={`crm-seg-btn ${segment === seg.id ? 'on' : ''}`}
                onClick={() => setSegment(seg.id)}
              >
                <span>{seg.label}</span>
                <span className="crm-seg-cnt tabular-nums">{seg.count}</span>
              </button>
            ))}
          </div>

          <div className="crm-controls-right">
            <div className="d-search-wrap crm-search-sm-wrap">
              <Search size={14} strokeWidth={2.2} className="d-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="d-input crm-search-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Naam, phone, dish ya tag…"
                aria-label="Customers search karo"
              />
            </div>
            <select
              className="d-select crm-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as CustomerSortKey)}
              aria-label="Sort customers"
            >
              <option value="recent">Sort: Last Visit</option>
              <option value="spend">Sort: Highest Spend</option>
              <option value="visits">Sort: Most Visits</option>
              <option value="points">Sort: Loyalty Points</option>
              <option value="name">Sort: Name (A–Z)</option>
            </select>
          </div>
        </div>

        {/* High-Density Data Table */}
        {filtered.length === 0 ? (
          <div className="crm-empty-box">
            <p className="dark-sub">
              {search || segment !== 'all'
                ? 'Is search ya segment mein koi customer nahi mila.'
                : 'Abhi koi customer record nahi hai. Guest QR scan karega ya aap + Add Customer se add kar sakte ho.'}
            </p>
            {(search || segment !== 'all') && (
              <button
                type="button"
                className="btn-ghost-dark"
                onClick={() => {
                  setSearch('');
                  setSegment('all');
                }}
              >
                Filters reset karo
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop High-Density Table */}
            <div className="crm-table-wrap crm-desktop-only">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Segment</th>
                    <th>Visits</th>
                    <th>Favorite Dish</th>
                    <th className="num">Spend</th>
                    <th className="num">Points</th>
                    <th className="num">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const isSel = selectedPhone === item.customer.phone;
                    return (
                      <tr
                        key={item.customer.phone}
                        className={`crm-tr ${isSel ? 'selected' : ''}`}
                      >
                        <td>
                          <button
                            type="button"
                            className="crm-guest-cell-btn"
                            onClick={() => setSelectedPhone(item.customer.phone)}
                            aria-label={`Open profile for ${item.customer.name}`}
                          >
                            <span className="crm-avatar-sm">
                              {item.customer.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="crm-guest-meta">
                              <strong className="crm-guest-name">{item.customer.name}</strong>
                              <span className="dark-sub tabular-nums crm-guest-sub">
                                +91 {item.customer.phone}
                                {item.customer.table ? ` · T${item.customer.table}` : ''}
                                {item.tags.length > 0 ? ` · ${item.tags.slice(0, 2).join(', ')}` : ''}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className={`crm-tier-txt tier-${item.tier}`}>{item.tierLabel}</span>
                        </td>
                        <td className="tabular-nums">
                          <div>{item.customer.visits} {item.customer.visits === 1 ? 'visit' : 'visits'}</div>
                          <div className="dark-sub" style={{ fontSize: 12 }}>
                            {formatRelativeVisit(item.customer.lastVisitAt, now)}
                          </div>
                        </td>
                        <td>
                          <div className="crm-dish-cell">{item.favoriteDish || '—'}</div>
                          <div className="dark-sub tabular-nums" style={{ fontSize: 12 }}>
                            {item.orderCount} {item.orderCount === 1 ? 'order' : 'orders'}
                          </div>
                        </td>
                        <td className="num tabular-nums">
                          <strong style={{ color: 'var(--gold)' }}>{fmt(item.totalSpent)}</strong>
                        </td>
                        <td className="num tabular-nums">
                          <strong>{item.loyaltyPoints}</strong>
                          <span className="dark-sub"> pts</span>
                        </td>
                        <td className="num">
                          <div className="crm-row-actions">
                            <button
                              type="button"
                              className="btn-ghost-dark btn-xs"
                              onClick={() => setSelectedPhone(item.customer.phone)}
                            >
                              Profile
                            </button>
                            <a
                              href={buildWhatsAppMessageUrl(
                                item.customer,
                                item.tier === 'dormant' ? 'winback' : 'promo',
                                activePromo
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm btn-green btn-xs"
                              aria-label={`WhatsApp ${item.customer.name}`}
                            >
                              <MessageCircle size={12} strokeWidth={2.3} aria-hidden="true" />
                              <span>WhatsApp</span>
                              <ExternalLink size={11} strokeWidth={2.2} aria-hidden="true" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Zero-Overflow Guest Cards */}
            <div className="crm-mobile-cards" aria-label="Mobile customer list">
              {filtered.map((item) => (
                <article key={item.customer.phone} className="crm-mobile-card">
                  <div className="crm-inline-between">
                    <button
                      type="button"
                      className="crm-guest-cell-btn"
                      onClick={() => setSelectedPhone(item.customer.phone)}
                      aria-label={`Open mobile profile for ${item.customer.name}`}
                    >
                      <span className="crm-avatar-sm">
                        {item.customer.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="crm-guest-meta">
                        <strong className="crm-guest-name">{item.customer.name}</strong>
                        <span className="dark-sub tabular-nums" style={{ fontSize: 12 }}>
                          +91 {item.customer.phone}
                        </span>
                      </span>
                    </button>
                    <span className={`crm-tier-txt tier-${item.tier}`}>{item.tierLabel}</span>
                  </div>

                  <div className="crm-mobile-meta tabular-nums">
                    <span>{item.customer.visits} visits · {formatRelativeVisit(item.customer.lastVisitAt, now)}</span>
                    <strong style={{ color: 'var(--gold)' }}>{fmt(item.totalSpent)}</strong>
                    <span>{item.loyaltyPoints} pts</span>
                  </div>

                  <div className="crm-mobile-card-actions">
                    <button
                      type="button"
                      className="btn-ghost-dark btn-xs"
                      onClick={() => setSelectedPhone(item.customer.phone)}
                    >
                      Open Profile
                    </button>
                    <a
                      href={buildWhatsAppMessageUrl(
                        item.customer,
                        item.tier === 'dormant' ? 'winback' : 'promo',
                        activePromo
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-green btn-xs"
                    >
                      <MessageCircle size={12} strokeWidth={2.3} aria-hidden="true" />
                      <span>WhatsApp</span>
                      <ExternalLink size={11} strokeWidth={2.2} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ============ 360° CUSTOMER PROFILE DRAWER ============ */}
      <AnimatePresence>
        {selectedInsight && (
          <motion.div
            className="crm-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPhone(null)}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label={`${selectedInsight.customer.name} customer profile`}
              className="crm-drawer"
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="crm-drawer-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div className="crm-avatar-lg">
                    {selectedInsight.customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="crm-inline-meta">
                      <h2 style={{ fontSize: 21 }}>{selectedInsight.customer.name}</h2>
                      <span className={`crm-tier-txt tier-${selectedInsight.tier}`}>
                        {selectedInsight.tierLabel}
                      </span>
                    </div>
                    <div className="dark-sub tabular-nums" style={{ marginTop: 2 }}>
                      +91 {selectedInsight.customer.phone}
                      {selectedInsight.customer.table ? ` · Table ${selectedInsight.customer.table}` : ''}
                      {' · '}
                      {selectedInsight.customer.visits} visits
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost-dark"
                  aria-label="Profile band karo"
                  onClick={() => setSelectedPhone(null)}
                >
                  <X size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <div className="crm-drawer-body">
                {/* 3 Profile Metrics + Loyalty Points Controls */}
                <div className="crm-profile-stats">
                  <div className="crm-pstat">
                    <span className="dark-sub">Lifetime Spend</span>
                    <strong className="tabular-nums" style={{ color: 'var(--gold)' }}>
                      {fmt(selectedInsight.totalSpent)}
                    </strong>
                    <span className="dark-sub tabular-nums" style={{ fontSize: 11.5 }}>
                      Avg {fmt(selectedInsight.avgOrderValue)}/order
                    </span>
                  </div>
                  <div className="crm-pstat">
                    <span className="dark-sub">Orders</span>
                    <strong className="tabular-nums">{selectedInsight.orderCount}</strong>
                    <span className="dark-sub" style={{ fontSize: 11.5 }}>
                      Fav: {selectedInsight.favoriteDish || '—'}
                    </span>
                  </div>
                  <div className="crm-pstat">
                    <span className="dark-sub">Loyalty Points</span>
                    <strong className="tabular-nums" style={{ color: '#5BE39A' }}>
                      {selectedInsight.loyaltyPoints} pts
                    </strong>
                    <div className="crm-pts-btns">
                      <button
                        type="button"
                        className="crm-pts-btn"
                        aria-label="Redeem 50 points"
                        onClick={() => {
                          adjustCustomerPoints(
                            selectedInsight.customer.phone,
                            -50,
                            selectedInsight.loyaltyPoints
                          );
                          showSakugaToast('50 points redeem ho gaye!', 'gold', '-50 PTS');
                        }}
                      >
                        -50
                      </button>
                      <button
                        type="button"
                        className="crm-pts-btn add"
                        aria-label="Add 50 bonus points"
                        onClick={() => {
                          adjustCustomerPoints(
                            selectedInsight.customer.phone,
                            50,
                            selectedInsight.loyaltyPoints
                          );
                          showSakugaToast('+50 bonus points add ho gaye!', 'green', '+50 PTS');
                        }}
                      >
                        +50
                      </button>
                    </div>
                  </div>
                </div>

                {/* 1-Tap Personalized WhatsApp, Visit Check-in & Call Actions */}
                <div className="crm-drawer-section">
                  <div className="crm-sub-label">Quick Actions &amp; Outreach</div>
                  <div className="crm-outreach-grid">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        recordCustomerVisit(selectedInsight.customer.phone);
                        showSakugaToast(
                          `${selectedInsight.customer.name} ka +1 visit & +5 pts log ho gaya!`,
                          'green',
                          'CHECK-IN!'
                        );
                      }}
                    >
                      <UserCheck size={14} strokeWidth={2.2} aria-hidden="true" />
                      <span>+1 Visit Check-in</span>
                    </button>
                    <a
                      href={buildWhatsAppMessageUrl(selectedInsight.customer, 'promo', activePromo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-green"
                    >
                      <MessageCircle size={14} strokeWidth={2.2} aria-hidden="true" />
                      <span>WhatsApp Promo</span>
                      <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
                    </a>
                    <a
                      href={buildWhatsAppMessageUrl(selectedInsight.customer, 'thanks', activePromo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost-dark"
                    >
                      <span>Thank You</span>
                      <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
                    </a>
                    <a
                      href={buildWhatsAppMessageUrl(selectedInsight.customer, 'winback', activePromo)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost-dark"
                    >
                      <span>Comeback Offer</span>
                      <ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
                    </a>
                    <a href={`tel:+91${selectedInsight.customer.phone}`} className="btn-ghost-dark">
                      <Phone size={13} strokeWidth={2.2} aria-hidden="true" />
                      <span>Call Guest</span>
                    </a>
                    <button
                      type="button"
                      className="btn-ghost-dark"
                      onClick={() => {
                        try {
                          void navigator.clipboard.writeText(selectedInsight.customer.phone);
                        } catch {
                          // Ignore
                        }
                        showSakugaToast(`${selectedInsight.customer.name} ka number copy ho gaya!`, 'gold', 'COPIED!');
                      }}
                    >
                      <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
                      <span>Copy Phone</span>
                    </button>
                  </div>
                </div>

                {/* Tags Editor */}
                <div className="crm-drawer-section">
                  <div className="crm-sub-label">Guest Tags</div>
                  <div className="crm-tag-toggle-row">
                    {Array.from(new Set([...PRESET_CRM_TAGS, ...selectedInsight.tags])).map((tag) => {
                      const active = selectedInsight.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`crm-tag-toggle dish-inline-label ${active ? 'on' : ''}`}
                          onClick={() => toggleTagForSelected(tag)}
                        >
                          {active ? (
                            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                          ) : (
                            <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                          )}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                  <form onSubmit={handleAddCustomTag} className="crm-inline-form">
                    <input
                      type="text"
                      className="d-input"
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      placeholder="Custom tag jodo (e.g. Jain Food)"
                      aria-label="Custom tag"
                    />
                    <button type="submit" className="btn-ghost-dark">
                      Add Tag
                    </button>
                  </form>
                </div>

                {/* Staff Notes & Birthday */}
                <form onSubmit={handleSaveDrawerProfile} className="crm-drawer-section">
                  <div className="crm-sub-label">Preferences, Notes &amp; Birthday</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label htmlFor="crm-edit-bday" className="d-label">
                        Birthday (optional)
                      </label>
                      <input
                        id="crm-edit-bday"
                        type="date"
                        className="d-input"
                        value={editBirthday}
                        onChange={(e) => setEditBirthday(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="crm-edit-notes" className="d-label">
                        Staff Notes (taste preferences, allergies, table choice)
                      </label>
                      <textarea
                        id="crm-edit-notes"
                        rows={3}
                        className="d-textarea"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="e.g. Extra hari chutney, kam cheeni chai..."
                      />
                    </div>
                    <button type="submit" className="btn btn-sm">
                      <Save size={14} strokeWidth={2.2} aria-hidden="true" />
                      <span>Save Profile Notes</span>
                    </button>
                  </div>
                </form>

                {/* Complete Order History */}
                <div className="crm-drawer-section">
                  <div className="crm-sub-label">
                    Order History ({selectedInsight.orders.length})
                  </div>
                  {selectedInsight.orders.length === 0 ? (
                    <p className="dark-sub">
                      Is number se abhi koi order link nahi hua hai. Agli baar order karte hi yahan dikhega.
                    </p>
                  ) : (
                    <div className="crm-list-gap">
                      {selectedInsight.orders.slice(0, 10).map((ord) => (
                        <div key={ord.id} className="crm-history-row">
                          <div className="crm-inline-between">
                            <strong className="tabular-nums">
                              #{shortId(ord.id)}
                              {ord.table !== null ? ` · Table ${ord.table}` : ' · Delivery'}
                            </strong>
                            <strong className="tabular-nums" style={{ color: 'var(--gold)' }}>
                              {fmt(orderTotal(ord, state.menu))}
                            </strong>
                          </div>
                          <div className="dark-sub" style={{ marginTop: 3 }}>
                            {ord.lines
                              .map((l) => `${l.qty}× ${byId(l.itemId, state.menu).name}`)
                              .join(', ')}
                          </div>
                          <div className="dark-sub tabular-nums" style={{ fontSize: 11.5, marginTop: 4 }}>
                            {formatRelativeVisit(ord.createdAt, now)}
                            {' · '}
                            {ord.paid ? `Paid (${ord.method || 'Cash'})` : ord.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Danger action */}
                <div className="crm-drawer-foot">
                  <button
                    type="button"
                    className="btn-ghost-dark"
                    style={{ color: '#FCA5A5' }}
                    onClick={() => {
                      const targetPhone = selectedInsight.customer.phone;
                      const targetName = selectedInsight.customer.name;
                      onRequestConfirm({
                        title: `"${targetName}" ko CRM se hatayein?`,
                        message:
                          'Customer profile, tags aur notes delete ho jayenge (purane order records safe rahenge).',
                        confirmLabel: 'Delete Customer',
                        onConfirm: () => {
                          deleteCustomerRecord(targetPhone);
                          setSelectedPhone(null);
                          showSakugaToast(`${targetName} CRM se delete ho gaya.`, 'gold', 'DELETED');
                        },
                      });
                    }}
                  >
                    <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span>Delete Customer Record</span>
                  </button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ ADD CUSTOMER MODAL ============ */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Naya customer add karo"
              className="crm-modal-card"
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="crm-inline-between" style={{ marginBottom: 14 }}>
                <h2 className="icon-heading" style={{ fontSize: 21 }}>
                  <UserPlus size={19} strokeWidth={2.2} style={{ color: 'var(--gold)' }} aria-hidden="true" />
                  <span>Naya Customer Add Karo</span>
                </h2>
                <button
                  type="button"
                  className="btn-ghost-dark"
                  aria-label="Modal band karo"
                  onClick={() => setShowAddModal(false)}
                >
                  <X size={16} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleAddCustomerSubmit} className="crm-stack" style={{ gap: 12 }}>
                <div className="form-grid-2">
                  <div>
                    <label htmlFor="add-cust-name" className="d-label">
                      Guest Name *
                    </label>
                    <input
                      id="add-cust-name"
                      type="text"
                      className="d-input"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="e.g. Meera Nair"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="add-cust-phone" className="d-label">
                      Mobile Number (10 digits) *
                    </label>
                    <input
                      id="add-cust-phone"
                      type="tel"
                      inputMode="numeric"
                      className="d-input"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label htmlFor="add-cust-pts" className="d-label">
                      Welcome Loyalty Points
                    </label>
                    <input
                      id="add-cust-pts"
                      type="number"
                      min={0}
                      className="d-input"
                      value={addPoints}
                      onChange={(e) => setAddPoints(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="add-cust-bday" className="d-label">
                      Birthday (optional)
                    </label>
                    <input
                      id="add-cust-bday"
                      type="date"
                      className="d-input"
                      value={addBirthday}
                      onChange={(e) => setAddBirthday(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <span className="d-label">Tags</span>
                  <div className="crm-tag-toggle-row">
                    {PRESET_CRM_TAGS.slice(0, 6).map((tag) => {
                      const active = addTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          className={`crm-tag-toggle dish-inline-label ${active ? 'on' : ''}`}
                          onClick={() =>
                            setAddTags((prev) =>
                              prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                            )
                          }
                        >
                          {active ? (
                            <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                          ) : (
                            <Plus size={12} strokeWidth={2.5} aria-hidden="true" />
                          )}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="add-cust-notes" className="d-label">
                    Preferences / Notes
                  </label>
                  <textarea
                    id="add-cust-notes"
                    rows={2}
                    className="d-textarea"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    placeholder="e.g. Spicy momos lover, prefers Table 4"
                  />
                </div>

                {addErr && (
                  <div role="alert" className="admin-error">
                    {addErr}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-ghost-dark"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn">
                    <Save size={15} strokeWidth={2.2} aria-hidden="true" />
                    <span>Save Customer</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
