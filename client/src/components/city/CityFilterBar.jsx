import { useEffect, useRef, useState } from 'react';

const STATUS_FILTERS = [
  { id: 'all', label: 'ALL', match: () => true },
  { id: 'online', label: 'ONLINE', match: (app) => !app.archived && app.overallStatus === 'online' },
  { id: 'stopped', label: 'STOPPED', match: (app) => !app.archived && app.overallStatus === 'stopped' },
  {
    id: 'errored',
    label: 'ERRORED',
    match: (app) => {
      if (app.archived) return false;
      const pm2 = app.pm2Status || {};
      return Object.values(pm2).some(s => s?.status === 'errored');
    },
  },
  {
    id: 'agent',
    label: 'AGENT',
    match: (app, { agentMap }) => agentMap?.has?.(app.id),
  },
];

// Compute the set of app IDs that should be dimmed in the 3D scene given the
// current filter + search query. The complement (matching apps) renders at full
// brightness; matches are also returned so a focus/jump action can use them.
export function computeFilterResult({ apps, status, search, agentMap }) {
  const matcher = STATUS_FILTERS.find(f => f.id === status) || STATUS_FILTERS[0];
  const trimmed = (search || '').trim().toLowerCase();
  const matches = [];
  const dimmed = new Set();

  (apps || []).forEach(app => {
    const passesStatus = matcher.match(app, { agentMap });
    const haystack = [app.name, app.id, ...(app.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const passesSearch = trimmed.length === 0 || haystack.includes(trimmed);
    if (passesStatus && passesSearch) {
      matches.push(app);
    } else {
      dimmed.add(app.id);
    }
  });

  return { matches, dimmed };
}

export default function CityFilterBar({ apps, agentMap, filter, onChange, matchCount, onJumpToFirst }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(Boolean(filter.search));

  // Press '/' to open search and focus input. Esc clears the query.
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable;
      if (e.key === '/' && !isTyping && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      if (e.key === 'Escape') {
        if (filter.search) onChange({ ...filter, search: '' });
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filter, onChange]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onJumpToFirst?.();
  };

  const chipBaseClass = 'font-pixel text-[9px] tracking-wider px-2 py-1 rounded border transition-colors';

  return (
    <div className="pointer-events-auto bg-black/85 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-2 py-2 flex items-center gap-2 flex-wrap">
      {/* Status chips */}
      <div className="flex items-center gap-1">
        {STATUS_FILTERS.map(f => {
          const active = filter.status === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange({ ...filter, status: f.id })}
              className={`${chipBaseClass} ${
                active
                  ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-300 shadow-[0_0_4px_rgba(6,182,212,0.3)]'
                  : 'border-cyan-500/20 text-cyan-500/50 hover:border-cyan-400/50 hover:text-cyan-300'
              }`}
              title={`Show ${f.label.toLowerCase()} only`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-cyan-500/20" />

      {/* Search */}
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
          className={`${chipBaseClass} border-cyan-500/20 text-cyan-500/50 hover:border-cyan-400/50 hover:text-cyan-300 flex items-center gap-1.5`}
          title="Search apps (press /)"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
          SEARCH
          <span className="font-pixel text-[8px] text-cyan-500/40 px-1 border border-cyan-500/20 rounded">/</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={filter.search}
            onChange={(e) => onChange({ ...filter, search: e.target.value })}
            onBlur={() => { if (!filter.search) setOpen(false); }}
            placeholder="search apps…"
            className="font-pixel text-[10px] tracking-wide bg-black/60 border border-cyan-500/30 rounded px-2 py-1 text-cyan-300 placeholder:text-cyan-500/30 focus:outline-none focus:border-cyan-400/70 w-32"
          />
          {filter.search && (
            <span className="font-pixel text-[8px] text-cyan-500/50 tracking-wider">
              {matchCount} {matchCount === 1 ? 'MATCH' : 'MATCHES'}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
