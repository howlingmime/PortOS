import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Play, BookOpen, Zap, Target, Check, X, SkipForward } from 'lucide-react';
import { submitMemoryPractice, getMemoryMastery } from '../../../services/api';

// Standard periodic table layout: [row][col] = symbol or null
const PERIODIC_TABLE = [
  ['H',  null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,'He'],
  ['Li','Be', null,null,null,null,null,null,null,null,null,null,'B', 'C', 'N', 'O', 'F', 'Ne'],
  ['Na','Mg', null,null,null,null,null,null,null,null,null,null,'Al','Si','P', 'S', 'Cl','Ar'],
  ['K', 'Ca','Sc','Ti','V', 'Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr'],
  ['Rb','Sr','Y', 'Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','I', 'Xe'],
  ['Cs','Ba','La','Hf','Ta','W', 'Re','Os','Ir','Pt','Au',null,'Tl','Pb','Bi','Po','At','Rn'],
  ['Fr','Ra','Ac',null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  // Lanthanides (Ce-Lu) and Actinides (Th-No) as separate rows
  [null,null,null,'Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu',null],
  [null,null,null,'Th','Pa','U', 'Np','Pu','Am','Cm','Bk','Cf','Es','Fm','Md','No',null,null],
];

const PRACTICE_MODES = [
  { id: 'learn', label: 'Learn Lyrics', icon: BookOpen, desc: 'Read through the song verse by verse' },
  { id: 'element-flash', label: 'Element Flash', icon: Zap, desc: 'Name elements from symbols or vice versa' },
  { id: 'fill-blank', label: 'Fill the Lyrics', icon: Target, desc: 'Fill in missing element names from the lyrics' },
];

export default function ElementsSong({ item, onBack }) {
  const [mastery, setMastery] = useState(item.mastery || { overallPct: 0, chunks: {}, elements: {} });
  const [mode, setMode] = useState(null);

  useEffect(() => {
    getMemoryMastery(item.id).then(m => { if (m) setMastery(m); }).catch(() => {});
  }, [item.id]);

  function handlePracticeComplete(newMastery) {
    if (newMastery) setMastery(newMastery);
    setMode(null);
  }

  if (mode === 'learn') return <LearnMode item={item} onBack={() => setMode(null)} onComplete={handlePracticeComplete} />;
  if (mode === 'element-flash') return <ElementFlashMode item={item} mastery={mastery} onBack={() => setMode(null)} onComplete={handlePracticeComplete} />;
  if (mode === 'fill-blank') return <FillBlankMode item={item} onBack={() => setMode(null)} onComplete={handlePracticeComplete} />;

  const elementMap = item.content?.elementMap || {};
  const songElements = new Set();
  for (const line of item.content?.lines || []) {
    for (const sym of line.elements || []) songElements.add(sym);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-white">The Elements Song</h2>
        <span className="text-gray-500 text-sm ml-auto">Tom Lehrer</span>
      </div>

      {/* Mastery header */}
      <div className="bg-port-card border border-port-border rounded-lg p-4 flex items-center justify-between">
        <div>
          <div className="text-gray-400 text-sm">Overall Mastery</div>
          <div className={`text-2xl font-bold font-mono ${mastery.overallPct >= 80 ? 'text-port-success' : mastery.overallPct >= 40 ? 'text-port-warning' : 'text-gray-500'}`}>
            {mastery.overallPct}%
          </div>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>{Object.keys(mastery.elements || {}).filter(s => { const m = mastery.elements[s]; return m?.attempts >= 3 && m.correct / m.attempts >= 0.8; }).length} / {Object.keys(elementMap).length} elements mastered</div>
          <div>{Object.keys(elementMap).length} elements in song</div>
        </div>
      </div>

      {/* Periodic Table Mastery Map */}
      <div className="bg-port-card border border-port-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Periodic Table Mastery</h3>
        <div className="overflow-x-auto">
          <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: 'repeat(18, 1fr)', minWidth: '540px' }}>
            {PERIODIC_TABLE.map((row, ri) =>
              row.map((sym, ci) => {
                if (!sym) return <div key={`${ri}-${ci}`} className="w-[30px] h-[30px]" />;
                const inSong = songElements.has(sym);
                const m = mastery.elements?.[sym];
                const masteryPct = m?.attempts > 0 ? m.correct / m.attempts : 0;
                const bg = !inSong ? 'bg-gray-800/30'
                  : masteryPct >= 0.8 && m.attempts >= 3 ? 'bg-emerald-600/60'
                  : masteryPct >= 0.5 ? 'bg-amber-600/50'
                  : m?.attempts > 0 ? 'bg-red-600/40'
                  : 'bg-port-border';
                const textColor = !inSong ? 'text-gray-700' : 'text-white';

                return (
                  <div
                    key={`${ri}-${ci}`}
                    className={`w-[30px] h-[30px] flex items-center justify-center text-[9px] font-mono rounded-sm ${bg} ${textColor} cursor-default`}
                    title={`${elementMap[sym]?.name || sym}${inSong ? ` (${m?.correct || 0}/${m?.attempts || 0})` : ' (not in song)'}`}
                  >
                    {sym}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-600/60 inline-block" /> Mastered</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-600/50 inline-block" /> Learning</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-600/40 inline-block" /> Needs work</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-port-border inline-block" /> Not started</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-800/30 inline-block" /> Not in song</span>
        </div>
      </div>

      {/* Practice Modes */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400">Practice</h3>
        {PRACTICE_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className="w-full bg-port-card border border-port-border rounded-lg p-4 text-left hover:border-port-accent/50 transition-colors flex items-center gap-4"
          >
            <m.icon size={20} className="text-emerald-400 shrink-0" />
            <div>
              <div className="text-white font-medium">{m.label}</div>
              <div className="text-gray-500 text-sm">{m.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Verse breakdown */}
      <div className="bg-port-card border border-port-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Verses</h3>
        <div className="space-y-3">
          {(item.content?.chunks || []).map(chunk => {
            const chunkMastery = mastery.chunks?.[chunk.id];
            const pct = chunkMastery?.attempts > 0 ? Math.round((chunkMastery.correct / chunkMastery.attempts) * 100) : 0;
            const lines = item.content.lines.slice(chunk.lineRange[0], chunk.lineRange[1] + 1);

            return (
              <details key={chunk.id} className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm py-1 hover:text-white text-gray-300">
                  <span>{chunk.label}</span>
                  <span className={`font-mono text-xs ${pct >= 80 ? 'text-port-success' : pct > 0 ? 'text-port-warning' : 'text-gray-600'}`}>
                    {pct > 0 ? `${pct}%` : '—'}
                  </span>
                </summary>
                <div className="mt-2 ml-2 space-y-1">
                  {lines.map((line, i) => (
                    <div key={i} className="text-xs text-gray-500 leading-relaxed">{line.text}</div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LEARN MODE
// =============================================================================

function LearnMode({ item, onBack, onComplete }) {
  const [currentChunk, setCurrentChunk] = useState(0);
  const [revealedLines, setRevealedLines] = useState(1);
  const chunks = item.content?.chunks || [];
  const chunk = chunks[currentChunk];
  const lines = chunk ? item.content.lines.slice(chunk.lineRange[0], chunk.lineRange[1] + 1) : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-white">Learn — {chunk?.label || 'Elements Song'}</h2>
        <span className="text-gray-500 text-sm ml-auto">{currentChunk + 1} / {chunks.length}</span>
      </div>

      <div className="w-full h-1.5 bg-port-border rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${((currentChunk * 10 + revealedLines) / (chunks.length * 10)) * 100}%` }} />
      </div>

      <div className="bg-port-card border border-port-border rounded-lg p-6">
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`text-sm leading-relaxed transition-all duration-300 ${
                i < revealedLines ? (i === revealedLines - 1 ? 'text-white font-medium text-base' : 'text-gray-400') : 'text-transparent select-none'
              }`}
            >
              {line.text}
              {i < revealedLines && line.elements?.length > 0 && (
                <span className="text-emerald-500/60 text-xs ml-2">
                  [{line.elements.join(', ')}]
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        {revealedLines < lines.length ? (
          <button
            onClick={() => setRevealedLines(prev => prev + 1)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
          >
            Reveal Next Line
          </button>
        ) : currentChunk < chunks.length - 1 ? (
          <button
            onClick={() => { setCurrentChunk(prev => prev + 1); setRevealedLines(1); }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
          >
            Next Verse
          </button>
        ) : (
          <button
            onClick={() => {
              submitMemoryPractice(item.id, {
                mode: 'learn', chunkId: null,
                results: [{ correct: true }],
                totalMs: 0,
              }).then(r => onComplete(r?.mastery)).catch(() => onComplete(null));
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-success hover:bg-port-success/80 text-white rounded-lg transition-colors"
          >
            <Check size={16} /> Complete
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ELEMENT FLASH MODE
// =============================================================================

function ElementFlashMode({ item, mastery, onBack, onComplete }) {
  const elementMap = item.content?.elementMap || {};
  const allElements = Object.entries(elementMap);

  // Prioritize weak elements
  const sorted = [...allElements].sort((a, b) => {
    const mA = mastery.elements?.[a[0]];
    const mB = mastery.elements?.[b[0]];
    const pctA = mA?.attempts > 0 ? mA.correct / mA.attempts : 0;
    const pctB = mB?.attempts > 0 ? mB.correct / mB.attempts : 0;
    return pctA - pctB;
  });

  const questions = sorted.slice(0, 15).sort(() => Math.random() - 0.5).map(([symbol, info]) => {
    const askSymbol = Math.random() > 0.5;
    return askSymbol
      ? { prompt: info.name, expected: symbol, element: symbol, label: 'What symbol?' }
      : { prompt: `${symbol} (${info.atomicNumber})`, expected: info.name, element: symbol, label: 'What element?' };
  });

  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(null);
  const [results, setResults] = useState([]);
  const [startTime] = useState(Date.now());
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [idx]);

  if (idx >= questions.length) {
    const correct = results.filter(r => r.correct).length;
    const pct = Math.round((correct / results.length) * 100);
    const scoreColor = pct >= 80 ? 'text-port-success' : pct >= 50 ? 'text-port-warning' : 'text-port-error';

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-white">Element Flash Complete</h2>
        </div>
        <div className="bg-port-card border border-port-border rounded-lg p-6 text-center">
          <div className={`text-5xl font-bold font-mono ${scoreColor} mb-2`}>{pct}%</div>
          <div className="text-gray-400 text-sm">{correct} of {results.length} correct</div>
        </div>
        {results.filter(r => !r.correct).length > 0 && (
          <div className="bg-port-card border border-port-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Missed</h3>
            <div className="grid grid-cols-2 gap-2">
              {results.filter(r => !r.correct).map((r, i) => (
                <div key={i} className="text-xs bg-port-bg rounded p-2">
                  <span className="text-port-error">{r.answered || '?'}</span>
                  <span className="text-gray-500 mx-1">&rarr;</span>
                  <span className="text-port-success">{r.expected}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => {
            submitMemoryPractice(item.id, {
              mode: 'element-flash', chunkId: null,
              results: results.map(r => ({ correct: r.correct, element: r.element, expected: r.expected, answered: r.answered })),
              totalMs: Date.now() - startTime,
            }).then(r => onComplete(r?.mastery)).catch(() => onComplete(null));
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
        >
          Save & Return
        </button>
      </div>
    );
  }

  const q = questions[idx];

  function check(skipped = false) {
    const isCorrect = !skipped && answer.trim().toLowerCase() === q.expected.toLowerCase();
    setResults(prev => [...prev, { correct: isCorrect, expected: q.expected, answered: answer.trim(), element: q.element }]);
    setShowResult(isCorrect ? 'correct' : 'wrong');
  }

  function next() {
    setIdx(prev => prev + 1);
    setAnswer('');
    setShowResult(null);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-white">Element Flash</h2>
        <span className="text-gray-500 text-sm ml-auto">{idx + 1} / {questions.length}</span>
      </div>

      <div className="w-full h-1.5 bg-port-border rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
      </div>

      <div className="bg-port-card border border-port-border rounded-lg p-8 text-center">
        <div className="text-3xl font-bold text-white mb-2">{q.prompt}</div>
        <div className="text-gray-500 text-sm">{q.label}</div>

        {showResult ? (
          <div className={`mt-6 text-lg font-medium ${showResult === 'correct' ? 'text-port-success' : 'text-port-error'}`}>
            {showResult === 'correct' ? 'Correct!' : `Wrong — answer: ${q.expected}`}
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') check(); }}
            className="mt-6 w-48 bg-port-bg border border-port-border rounded-lg px-4 py-2.5 text-white text-center text-lg placeholder-gray-600 focus:border-port-accent focus:outline-none"
            placeholder="..."
            autoComplete="off"
          />
        )}
      </div>

      <div className="flex gap-3">
        {showResult ? (
          <button onClick={next} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors">
            Next
          </button>
        ) : (
          <>
            <button
              onClick={() => check()}
              disabled={!answer.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Check size={16} /> Check
            </button>
            <button
              onClick={() => check(true)}
              className="px-4 py-2.5 bg-port-card border border-port-border rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <SkipForward size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// FILL BLANK MODE (lyrics-specific)
// =============================================================================

function FillBlankMode({ item, onBack, onComplete }) {
  const lines = (item.content?.lines || []).filter(l => l.elements?.length > 0);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(null);
  const [results, setResults] = useState([]);
  const [startTime] = useState(Date.now());
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, [idx]);

  if (idx >= lines.length) {
    const correct = results.filter(r => r.correct).length;
    const pct = Math.round((correct / results.length) * 100);
    const scoreColor = pct >= 80 ? 'text-port-success' : pct >= 50 ? 'text-port-warning' : 'text-port-error';

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-white">Fill the Lyrics Complete</h2>
        </div>
        <div className="bg-port-card border border-port-border rounded-lg p-6 text-center">
          <div className={`text-5xl font-bold font-mono ${scoreColor} mb-2`}>{pct}%</div>
          <div className="text-gray-400 text-sm">{correct} of {results.length} lines correct</div>
        </div>
        <button
          onClick={() => {
            submitMemoryPractice(item.id, {
              mode: 'fill-blank', chunkId: null,
              results: results.map(r => ({ correct: r.correct, expected: r.expected, answered: r.answered })),
              totalMs: Date.now() - startTime,
            }).then(r => onComplete(r?.mastery)).catch(() => onComplete(null));
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
        >
          Save & Return
        </button>
      </div>
    );
  }

  const line = lines[idx];
  const elementMap = item.content?.elementMap || {};

  // Blank out element names
  const words = line.text.split(/\s+/);
  const blankedWords = [];
  const display = words.map(w => {
    const clean = w.toLowerCase().replace(/[,.\s]/g, '');
    for (const [sym, info] of Object.entries(elementMap)) {
      if (info.name.toLowerCase() === clean && line.elements?.includes(sym)) {
        blankedWords.push(info.name);
        return '________';
      }
    }
    return w;
  }).join(' ');

  function check(skipped = false) {
    const userWords = skipped ? [] : answer.split(',').map(w => w.trim().toLowerCase());
    const expectedWords = blankedWords.map(w => w.toLowerCase());
    const allCorrect = expectedWords.every((ew, i) => userWords[i] === ew);
    setResults(prev => [...prev, {
      correct: allCorrect,
      expected: blankedWords.join(', '),
      answered: skipped ? '' : answer,
    }]);
    setShowResult(allCorrect ? 'correct' : 'wrong');
  }

  function next() {
    setIdx(prev => prev + 1);
    setAnswer('');
    setShowResult(null);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-white">Fill the Lyrics</h2>
        <span className="text-gray-500 text-sm ml-auto">{idx + 1} / {lines.length}</span>
      </div>

      <div className="w-full h-1.5 bg-port-border rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${((idx + 1) / lines.length) * 100}%` }} />
      </div>

      <div className="bg-port-card border border-port-border rounded-lg p-6">
        <div className="text-white text-lg leading-relaxed mb-4 font-mono">{display}</div>
        <div className="text-gray-500 text-xs mb-2">
          Element symbols in this line: {line.elements?.join(', ')}
        </div>

        {showResult ? (
          <div className="space-y-2 mt-4">
            <div className={`text-sm ${showResult === 'correct' ? 'text-port-success' : 'text-port-error'}`}>
              {showResult === 'correct' ? 'Correct!' : `Expected: ${blankedWords.join(', ')}`}
            </div>
            <div className="text-sm text-gray-400">{line.text}</div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-gray-400 text-xs mb-1">Name the blanked elements (comma-separated):</div>
            <input
              ref={inputRef}
              type="text"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') check(); }}
              placeholder={`${blankedWords.length} element${blankedWords.length > 1 ? 's' : ''}...`}
              className="w-full bg-port-bg border border-port-border rounded px-4 py-2.5 text-white placeholder-gray-600 focus:border-port-accent focus:outline-none"
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {showResult ? (
          <button onClick={next} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors">
            {idx + 1 < lines.length ? 'Next' : 'Finish'}
          </button>
        ) : (
          <>
            <button
              onClick={() => check()}
              disabled={!answer.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              <Check size={16} /> Check
            </button>
            <button
              onClick={() => check(true)}
              className="px-4 py-2.5 bg-port-card border border-port-border rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <SkipForward size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
