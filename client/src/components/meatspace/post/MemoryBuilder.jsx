import { useState, useEffect } from 'react';
import { Brain, ChevronLeft, Plus, Trash2, BookOpen, Zap, FlaskConical, Eye } from 'lucide-react';
import { getMemoryItems, deleteMemoryItem } from '../../../services/api';
import MemoryPractice from './MemoryPractice';
import ElementsSong from './ElementsSong';

export default function MemoryBuilder({ onBack }) {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [view, setView] = useState('list'); // list, practice, elements

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    const data = await getMemoryItems().catch(() => []);
    setItems(data || []);
  }

  function handleSelect(item) {
    setSelectedItem(item);
    if (item.id === 'elements-song') {
      setView('elements');
    } else {
      setView('practice');
    }
  }

  async function handleDelete(id) {
    await deleteMemoryItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function handlePracticeComplete() {
    loadItems();
    setView('list');
    setSelectedItem(null);
  }

  if (view === 'elements' && selectedItem) {
    return (
      <ElementsSong
        item={selectedItem}
        onBack={() => { setView('list'); setSelectedItem(null); loadItems(); }}
      />
    );
  }

  if (view === 'practice' && selectedItem) {
    return (
      <MemoryPractice
        item={selectedItem}
        onBack={() => { setView('list'); setSelectedItem(null); }}
        onComplete={handlePracticeComplete}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <Brain size={24} className="text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Memory Builder</h2>
        </div>
      </div>

      <p className="text-gray-400 text-sm">
        Train your memory with songs, poems, speeches, and sequences. Track mastery and practice weak spots.
      </p>

      {/* Memory Items */}
      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className="bg-port-card border border-port-border rounded-lg p-4 hover:border-port-accent/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <ItemIcon type={item.type} builtin={item.builtin} />
                <div className="min-w-0">
                  <h3 className="text-white font-medium truncate">{item.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>{item.type}</span>
                    <span>{item.content?.lines?.length || 0} lines</span>
                    {item.builtin && <span className="text-emerald-500">built-in</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MasteryBadge pct={item.mastery?.overallPct || 0} />
                <button
                  onClick={() => handleSelect(item)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-port-accent hover:bg-port-accent/80 text-white rounded-lg transition-colors"
                >
                  <BookOpen size={14} />
                  Practice
                </button>
                {!item.builtin && (
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-gray-500 hover:text-port-error transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="bg-port-card border border-port-border rounded-lg p-8 text-center">
            <Brain size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No memory items yet. The Elements Song will be added automatically.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemIcon({ type, builtin }) {
  if (builtin) return <FlaskConical size={20} className="text-emerald-400 shrink-0" />;
  switch (type) {
    case 'song': return <Zap size={20} className="text-purple-400 shrink-0" />;
    case 'poem': return <BookOpen size={20} className="text-blue-400 shrink-0" />;
    case 'speech': return <Eye size={20} className="text-amber-400 shrink-0" />;
    default: return <Brain size={20} className="text-gray-400 shrink-0" />;
  }
}

function MasteryBadge({ pct }) {
  const color = pct >= 80 ? 'text-port-success' : pct >= 40 ? 'text-port-warning' : 'text-gray-500';
  return (
    <div className={`text-sm font-mono font-medium ${color}`}>
      {pct}%
    </div>
  );
}
