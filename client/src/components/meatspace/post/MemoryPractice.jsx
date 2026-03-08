import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Play, Check, X, SkipForward, RotateCcw } from 'lucide-react';
import { submitMemoryPractice } from '../../../services/api';

const MODES = [
  { id: 'learn', label: 'Learn', desc: 'Progressive reveal — read and absorb line by line' },
  { id: 'fill-blank', label: 'Fill in the Blank', desc: 'Fill missing words in partially shown lines' },
  { id: 'sequence', label: 'Sequence Recall', desc: 'Given a line, type what comes next' },
  { id: 'speed-run', label: 'Speed Run', desc: 'Recite the full sequence as fast as possible' },
];

export default function MemoryPractice({ item, onBack, onComplete }) {
  const [mode, setMode] = useState(null);
  const [results, setResults] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(null); // null | 'correct' | 'wrong'
  const [done, setDone] = useState(false);
  const [startTime] = useState(Date.now());
  const inputRef = useRef(null);

  const lines = item.content?.lines || [];

  useEffect(() => {
    if (mode && inputRef.current) inputRef.current.focus();
  }, [mode, currentIdx]);

  if (!mode) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-white">{item.title}</h2>
        </div>

        <p className="text-gray-400 text-sm">Choose a practice mode:</p>

        <div className="space-y-3">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="w-full bg-port-card border border-port-border rounded-lg p-4 text-left hover:border-port-accent/50 transition-colors"
            >
              <div className="text-white font-medium">{m.label}</div>
              <div className="text-gray-500 text-sm mt-1">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (done) {
    const correct = results.filter(r => r.correct).length;
    const pct = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
    const scoreColor = pct >= 80 ? 'text-port-success' : pct >= 50 ? 'text-port-warning' : 'text-port-error';

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-bold text-white">Practice Complete</h2>
        </div>

        <div className="bg-port-card border border-port-border rounded-lg p-6 text-center">
          <div className={`text-5xl font-bold font-mono ${scoreColor} mb-2`}>{pct}%</div>
          <div className="text-gray-400 text-sm">{correct} of {results.length} correct</div>
          <div className="text-gray-500 text-xs mt-1">
            {Math.round((Date.now() - startTime) / 1000)}s elapsed
          </div>
        </div>

        {/* Show wrong answers */}
        {results.filter(r => !r.correct).length > 0 && (
          <div className="bg-port-card border border-port-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Review mistakes</h3>
            <div className="space-y-2">
              {results.filter(r => !r.correct).map((r, i) => (
                <div key={i} className="text-sm">
                  <div className="text-port-error">Your answer: {r.answered || '(skipped)'}</div>
                  <div className="text-port-success">Expected: {r.expected}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => { setMode(null); setResults([]); setCurrentIdx(0); setDone(false); setShowResult(null); }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-card border border-port-border rounded-lg text-gray-300 hover:text-white transition-colors"
          >
            <RotateCcw size={16} />
            Try Again
          </button>
          <button
            onClick={onBack}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // LEARN mode — progressive reveal
  if (mode === 'learn') {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-white">Learn — {item.title}</h2>
          <span className="text-gray-500 text-sm ml-auto">{currentIdx + 1} / {lines.length}</span>
        </div>

        <ProgressBar current={currentIdx + 1} total={lines.length} />

        <div className="bg-port-card border border-port-border rounded-lg p-6">
          <div className="space-y-2">
            {lines.slice(0, currentIdx + 1).map((line, i) => (
              <div
                key={i}
                className={`text-sm leading-relaxed transition-all ${
                  i === currentIdx ? 'text-white font-medium text-base' : 'text-gray-500'
                }`}
              >
                {line.text}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          {currentIdx > 0 && (
            <button
              onClick={() => setCurrentIdx(prev => prev - 1)}
              className="px-4 py-2.5 bg-port-card border border-port-border rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              Previous
            </button>
          )}
          {currentIdx < lines.length - 1 ? (
            <button
              onClick={() => setCurrentIdx(prev => prev + 1)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
            >
              Next Line
            </button>
          ) : (
            <button
              onClick={() => { setDone(true); setResults([{ correct: true, expected: 'learn mode', answered: 'learn mode' }]); savePractice('learn', [{ correct: true }]); }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-success hover:bg-port-success/80 text-white rounded-lg transition-colors"
            >
              <Check size={16} />
              Complete
            </button>
          )}
        </div>
      </div>
    );
  }

  // SEQUENCE mode — given a line, type the next one
  if (mode === 'sequence') {
    const promptLine = lines[currentIdx];
    const expectedLine = lines[currentIdx + 1];

    if (!expectedLine) {
      finishSequence();
      return null;
    }

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-white">Sequence — {item.title}</h2>
          <span className="text-gray-500 text-sm ml-auto">{currentIdx + 1} / {lines.length - 1}</span>
        </div>

        <ProgressBar current={currentIdx + 1} total={lines.length - 1} />

        <div className="bg-port-card border border-port-border rounded-lg p-6">
          <div className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Current line:</div>
          <div className="text-white text-lg leading-relaxed mb-6">{promptLine.text}</div>

          <div className="text-gray-400 text-xs mb-2 uppercase tracking-wide">What comes next?</div>
          {showResult ? (
            <div className="space-y-2">
              <div className={`text-sm p-3 rounded ${showResult === 'correct' ? 'bg-port-success/10 text-port-success' : 'bg-port-error/10 text-port-error'}`}>
                {showResult === 'correct' ? 'Correct!' : `Your answer: ${answer}`}
              </div>
              {showResult === 'wrong' && (
                <div className="text-sm p-3 rounded bg-port-success/10 text-port-success">
                  Expected: {expectedLine.text}
                </div>
              )}
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); checkSequenceAnswer(expectedLine.text); } }}
              placeholder="Type the next line..."
              className="w-full bg-port-bg border border-port-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-port-accent focus:outline-none resize-none"
              rows={2}
            />
          )}
        </div>

        <div className="flex gap-3">
          {showResult ? (
            <button
              onClick={nextSequenceQuestion}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
            >
              {currentIdx + 1 < lines.length - 1 ? 'Next' : 'Finish'}
            </button>
          ) : (
            <>
              <button
                onClick={() => checkSequenceAnswer(expectedLine.text)}
                disabled={!answer.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <Check size={16} />
                Check
              </button>
              <button
                onClick={() => { setAnswer(''); checkSequenceAnswer(expectedLine.text, true); }}
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

  // FILL-IN-THE-BLANK mode
  if (mode === 'fill-blank') {
    const line = lines[currentIdx];
    const words = line?.text.split(/\s+/) || [];
    // Blank out ~40% of words
    const [blanks] = useState(() => {
      const blankSet = new Set();
      const count = Math.max(1, Math.floor(words.length * 0.4));
      while (blankSet.size < count && blankSet.size < words.length) {
        blankSet.add(Math.floor(Math.random() * words.length));
      }
      return blankSet;
    });

    const blankWords = [...blanks].sort((a, b) => a - b).map(i => words[i]?.replace(/[,.]$/, ''));
    const displayText = words.map((w, i) => blanks.has(i) ? '____' : w).join(' ');

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-white">Fill Blank — {item.title}</h2>
          <span className="text-gray-500 text-sm ml-auto">{currentIdx + 1} / {lines.length}</span>
        </div>

        <ProgressBar current={currentIdx + 1} total={lines.length} />

        <div className="bg-port-card border border-port-border rounded-lg p-6">
          <div className="text-white text-lg leading-relaxed mb-4 font-mono">{displayText}</div>

          {showResult ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-400">Full line:</div>
              <div className="text-port-success text-sm">{line.text}</div>
            </div>
          ) : (
            <div>
              <div className="text-gray-400 text-xs mb-2">Fill the blanks (comma-separated):</div>
              <input
                ref={inputRef}
                type="text"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') checkFillBlank(blankWords); }}
                placeholder={`${blankWords.length} word${blankWords.length > 1 ? 's' : ''} missing...`}
                className="w-full bg-port-bg border border-port-border rounded px-4 py-2.5 text-white placeholder-gray-600 focus:border-port-accent focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {showResult ? (
            <button
              onClick={nextFillBlank}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
            >
              {currentIdx + 1 < lines.length ? 'Next' : 'Finish'}
            </button>
          ) : (
            <>
              <button
                onClick={() => checkFillBlank(blankWords)}
                disabled={!answer.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-port-accent hover:bg-port-accent/80 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                <Check size={16} />
                Check
              </button>
              <button
                onClick={() => { setAnswer(''); checkFillBlank(blankWords, true); }}
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

  // SPEED RUN mode — show all lines, check how many you can recite
  if (mode === 'speed-run') {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-lg font-bold text-white">Speed Run — {item.title}</h2>
        </div>

        <div className="bg-port-card border border-port-border rounded-lg p-6">
          <p className="text-gray-400 text-sm mb-4">
            Try to recite the full text from memory. Tap each line to reveal it and check yourself.
          </p>
          <div className="space-y-1">
            {lines.map((line, i) => (
              <SpeedRunLine key={i} line={line} index={i} onResult={(correct) => {
                setResults(prev => [...prev, { correct, expected: line.text, answered: correct ? line.text : '(wrong)' }]);
              }} />
            ))}
          </div>
        </div>

        {results.length === lines.length && (
          <button
            onClick={() => { savePractice('speed-run', results); setDone(true); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-port-success hover:bg-port-success/80 text-white rounded-lg transition-colors"
          >
            <Check size={16} />
            Finish ({results.filter(r => r.correct).length}/{results.length} correct)
          </button>
        )}
      </div>
    );
  }

  return null;

  // --- Helpers ---

  function checkSequenceAnswer(expected, skipped = false) {
    const isCorrect = !skipped && fuzzyMatch(answer, expected);
    setResults(prev => [...prev, { correct: isCorrect, expected, answered: skipped ? '' : answer, element: null }]);
    setShowResult(isCorrect ? 'correct' : 'wrong');
  }

  function nextSequenceQuestion() {
    if (currentIdx + 1 >= lines.length - 1) {
      finishSequence();
    } else {
      setCurrentIdx(prev => prev + 1);
      setAnswer('');
      setShowResult(null);
    }
  }

  function finishSequence() {
    savePractice('sequence', results);
    setDone(true);
  }

  function checkFillBlank(blankWords, skipped = false) {
    const userWords = skipped ? [] : answer.split(',').map(w => w.trim().toLowerCase());
    const correct = blankWords.every((bw, i) =>
      userWords[i] && userWords[i] === bw.toLowerCase()
    );
    setResults(prev => [...prev, {
      correct,
      expected: blankWords.join(', '),
      answered: skipped ? '' : answer,
    }]);
    setShowResult(correct ? 'correct' : 'wrong');
  }

  function nextFillBlank() {
    if (currentIdx + 1 >= lines.length) {
      savePractice('fill-blank', results);
      setDone(true);
    } else {
      setCurrentIdx(prev => prev + 1);
      setAnswer('');
      setShowResult(null);
    }
  }

  async function savePractice(practiceMode, practiceResults) {
    const chunkId = findChunkForLine(item, currentIdx);
    await submitMemoryPractice(item.id, {
      mode: practiceMode,
      chunkId,
      results: practiceResults.map(r => ({
        correct: r.correct,
        word: r.expected?.split(' ')[0],
        element: r.element || null,
        expected: r.expected,
        answered: r.answered,
      })),
      totalMs: Date.now() - startTime,
    }).catch(() => {});
  }
}

function SpeedRunLine({ line, index, onResult }) {
  const [revealed, setRevealed] = useState(false);
  const [marked, setMarked] = useState(null);

  function reveal() {
    if (!revealed) setRevealed(true);
  }

  function mark(correct) {
    setMarked(correct);
    onResult(correct);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-600 text-xs w-6 text-right shrink-0">{index + 1}</span>
      {!revealed ? (
        <button
          onClick={reveal}
          className="flex-1 text-left px-3 py-1.5 bg-port-bg border border-port-border rounded text-gray-600 hover:text-gray-400 hover:border-port-accent/30 transition-colors text-sm"
        >
          Tap to reveal...
        </button>
      ) : (
        <div className="flex-1 flex items-center gap-2">
          <span className={`text-sm flex-1 ${marked === true ? 'text-port-success' : marked === false ? 'text-port-error' : 'text-white'}`}>
            {line.text}
          </span>
          {marked === null && (
            <div className="flex gap-1 shrink-0">
              <button onClick={() => mark(true)} className="p-1 text-port-success hover:bg-port-success/10 rounded"><Check size={14} /></button>
              <button onClick={() => mark(false)} className="p-1 text-port-error hover:bg-port-error/10 rounded"><X size={14} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full h-1.5 bg-port-border rounded-full overflow-hidden">
      <div className="h-full bg-port-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function fuzzyMatch(input, expected) {
  const normalize = s => s.toLowerCase().replace(/[,.\-!?'"]/g, '').replace(/\s+/g, ' ').trim();
  const a = normalize(input);
  const b = normalize(expected);
  if (a === b) return true;
  // Allow 80% word match
  const aWords = a.split(' ');
  const bWords = b.split(' ');
  const matches = bWords.filter(w => aWords.includes(w)).length;
  return matches / bWords.length >= 0.8;
}

function findChunkForLine(item, lineIndex) {
  for (const chunk of item.content?.chunks || []) {
    const [start, end] = chunk.lineRange;
    if (lineIndex >= start && lineIndex <= end) return chunk.id;
  }
  return null;
}
