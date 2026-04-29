import MicroGlyph from './MicroGlyph';
import './micrographics.css';

// Context-aware micrographic loader. Used in a small set of empty states
// (Dashboard / Apps grid / CoS empty list); BrailleSpinner remains the
// default loader everywhere else.
export default function MicroLoader({
  label,
  module = 'LOAD',
  status = 'WAITING',
  glyph = 'orbit',
  block = false,
  size = 18,
  className = '',
}) {
  const classes = [
    'port-microloader',
    block ? 'port-microloader--block' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status" aria-live="polite">
      <MicroGlyph variant={glyph} size={size} animated state="accent" title={label || `${module} ${status}`} />
      <span className="port-microloader__label">
        <span style={{ opacity: 0.85 }}>{module}</span>
        <span style={{ opacity: 0.45, margin: '0 0.35em' }}>//</span>
        <span style={{ fontWeight: 600 }}>{status}</span>
      </span>
      {label && (
        <span className="port-microloader__label" style={{ opacity: 0.75, fontFamily: 'var(--port-font-mono)', textTransform: 'none', letterSpacing: 0 }}>
          {label}
        </span>
      )}
    </div>
  );
}
