import { useState } from 'react';
import { CRON_PRESETS, describeCron } from '../utils/cronHelpers';

/**
 * Inline cron expression editor with presets dropdown.
 * Shows a text input + presets select + human-readable description.
 * Calls onSave with the validated expression, onCancel to dismiss.
 */
export default function CronInput({ value, onSave, onCancel, className = '' }) {
  const [expr, setExpr] = useState(value || '0 7 * * *');

  const handleSave = () => {
    const trimmed = expr.trim();
    if (trimmed.split(/\s+/).length !== 5) return;
    onSave(trimmed);
  };

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <input
        type="text"
        value={expr}
        onChange={e => setExpr(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') onCancel?.();
        }}
        className="w-28 sm:w-32 px-2 py-1 bg-port-bg border border-port-border rounded text-xs text-white font-mono focus:border-port-accent focus:outline-hidden"
        placeholder="0 7 * * *"
        autoFocus
      />
      <select
        value=""
        onChange={e => { if (e.target.value) setExpr(e.target.value); }}
        className="px-1 py-1 bg-port-bg border border-port-border rounded text-gray-400 text-xs"
      >
        <option value="">Presets</option>
        {CRON_PRESETS.map(p => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      <button
        onClick={handleSave}
        className="px-1.5 py-1 bg-port-accent/20 text-port-accent rounded text-xs hover:bg-port-accent/30"
      >
        OK
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          className="px-1.5 py-1 text-gray-500 hover:text-gray-300 rounded text-xs"
        >
          X
        </button>
      )}
      {expr && (
        <span className="text-xs text-gray-500 truncate hidden sm:inline">{describeCron(expr)}</span>
      )}
    </div>
  );
}
