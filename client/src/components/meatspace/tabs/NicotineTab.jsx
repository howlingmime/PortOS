import { useState, useEffect, useCallback, useMemo } from 'react';
import { Cigarette, Plus, Trash2, Pencil, Check, X, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../../../services/api';
import BrailleSpinner from '../../BrailleSpinner';
import NicotineChart from '../NicotineChart';
import NicotineHealthCorrelation from '../NicotineHealthCorrelation';
import { dayOfWeek, localDateStr } from '../constants';

const DAYS_PER_PAGE = 50;

export default function NicotineTab() {
  const [summary, setSummary] = useState(null);
  const [allEntries, setAllEntries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);

  // Custom product buttons
  const [productButtons, setProductButtons] = useState([]);
  const [managingButtons, setManagingButtons] = useState(false);
  const [editingButtonIdx, setEditingButtonIdx] = useState(null);
  const [buttonForm, setButtonForm] = useState({ name: '', mgPerUnit: '' });

  // Form state
  const today = useMemo(() => localDateStr(), []);
  const [product, setProduct] = useState('');
  const [mgPerUnit, setMgPerUnit] = useState('');
  const [count, setCount] = useState(1);
  const [date, setDate] = useState(today);

  // Inline edit state
  const [editingKey, setEditingKey] = useState(null);
  const [editForm, setEditForm] = useState({ product: '', mgPerUnit: '', count: 1 });

  // Correlation chart state
  const [chartView, setChartView] = useState('30d');
  const [correlationData, setCorrelationData] = useState(null);

  const fetchProductButtons = useCallback(async () => {
    const buttons = await api.getCustomNicotineProducts().catch(() => null);
    if (Array.isArray(buttons)) {
      setProductButtons(buttons);
    }
  }, []);

  const fetchData = useCallback(async () => {
    const [summaryData, entries] = await Promise.all([
      api.getNicotineSummary().catch(() => null),
      api.getDailyNicotine().catch(() => [])
    ]);
    setSummary(summaryData);
    setAllEntries(entries);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProductButtons();
  }, [fetchProductButtons]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Fetch correlation data — memoize date range to avoid refetch on every render
  const { correlationFrom, correlationTo } = useMemo(() => {
    const days = { '7d': 7, '30d': 30, '90d': 90 }[chartView] || 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return { correlationFrom: localDateStr(d), correlationTo: localDateStr() };
  }, [chartView]);

  useEffect(() => {
    api.getAppleHealthCorrelation(correlationFrom, correlationTo)
      .then(setCorrelationData)
      .catch(() => setCorrelationData(null));
  }, [correlationFrom, correlationTo]);

  const handleQuickAdd = async (prod) => {
    setLogging(true);
    await api.logNicotine({
      product: prod.name,
      mgPerUnit: prod.mgPerUnit,
      count: 1,
      date: date || undefined
    }).catch(() => null);
    setLogging(false);
    setRefreshKey(k => k + 1);
  };

  const handleCustomAdd = async (e) => {
    e.preventDefault();
    if (!mgPerUnit) return;
    setLogging(true);
    await api.logNicotine({
      product: product || '',
      mgPerUnit: parseFloat(mgPerUnit),
      count: count || 1,
      date: date || undefined
    }).catch(() => null);
    setLogging(false);
    setProduct('');
    setMgPerUnit('');
    setCount(1);
    setRefreshKey(k => k + 1);
  };

  const handleRemove = async (entryDate, index) => {
    await api.removeNicotineEntry(entryDate, index).catch(() => null);
    setRefreshKey(k => k + 1);
  };

  const startEdit = (entryDate, index, item) => {
    setEditingKey(`${entryDate}:${index}`);
    setEditForm({
      product: item.product || '',
      mgPerUnit: String(item.mgPerUnit || ''),
      count: item.count || 1,
      date: entryDate
    });
  };

  const cancelEdit = () => {
    setEditingKey(null);
  };

  const saveEdit = async () => {
    if (!editingKey) return;
    const [entryDate, indexStr] = editingKey.split(':');
    const index = parseInt(indexStr, 10);
    await api.updateNicotineEntry(entryDate, index, {
      product: editForm.product,
      mgPerUnit: parseFloat(editForm.mgPerUnit),
      count: parseInt(editForm.count, 10) || 1,
      date: editForm.date !== entryDate ? editForm.date : undefined
    }).catch(() => null);
    setEditingKey(null);
    setRefreshKey(k => k + 1);
  };

  // === Custom product button management ===

  const validateProductButton = (form) => {
    if (!form.name) return 'Name is required';
    const parsed = parseFloat(form.mgPerUnit);
    if (isNaN(parsed) || parsed < 0.1 || parsed > 100) return 'mg must be between 0.1 and 100';
    return null;
  };

  const handleAddButton = async (e) => {
    e.preventDefault();
    const error = validateProductButton(buttonForm);
    if (error) { toast.error(error); return; }
    const result = await api.addCustomNicotineProduct({ name: buttonForm.name, mgPerUnit: parseFloat(buttonForm.mgPerUnit) }).catch(() => null);
    if (!result) { toast.error('Failed to add product button'); return; }
    setButtonForm({ name: '', mgPerUnit: '' });
    fetchProductButtons();
  };

  const startEditButton = (idx) => {
    const btn = productButtons[idx];
    setEditingButtonIdx(idx);
    setButtonForm({ name: btn.name, mgPerUnit: String(btn.mgPerUnit) });
  };

  const saveEditButton = async () => {
    if (editingButtonIdx === null) return;
    const error = validateProductButton(buttonForm);
    if (error) { toast.error(error); return; }
    const result = await api.updateCustomNicotineProduct(editingButtonIdx, { name: buttonForm.name, mgPerUnit: parseFloat(buttonForm.mgPerUnit) }).catch(() => null);
    if (!result) { toast.error('Failed to update product button'); return; }
    setEditingButtonIdx(null);
    setButtonForm({ name: '', mgPerUnit: '' });
    fetchProductButtons();
  };

  const cancelEditButton = () => {
    setEditingButtonIdx(null);
    setButtonForm({ name: '', mgPerUnit: '' });
  };

  const handleRemoveButton = async (idx) => {
    await api.removeCustomNicotineProduct(idx).catch(() => null);
    fetchProductButtons();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <BrailleSpinner text="Loading" />
      </div>
    );
  }

  const visibleEntries = allEntries?.slice(0, visibleDays) || [];
  const hasMore = allEntries?.length > visibleDays;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && (
        <div className="bg-port-card border border-port-border rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cigarette size={18} className="text-gray-400" />
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Nicotine Summary
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <span className="text-xs text-gray-500">Today</span>
              <p className="text-2xl font-bold text-white">
                {summary.today ?? 0} mg
              </p>
              <span className="text-xs text-gray-600">{summary.todayCount ?? 0} units</span>
            </div>
            <div>
              <span className="text-xs text-gray-500">7-Day Avg</span>
              <p className="text-2xl font-bold text-white">
                {summary.avg7day ?? 0} mg
              </p>
              <span className="text-xs text-gray-600">per day</span>
            </div>
            <div>
              <span className="text-xs text-gray-500">30-Day Avg</span>
              <p className="text-2xl font-bold text-white">
                {summary.avg30day ?? 0} mg
              </p>
              <span className="text-xs text-gray-600">per day</span>
            </div>
            <div>
              <span className="text-xs text-gray-500">Weekly Total</span>
              <p className="text-2xl font-bold text-white">
                {summary.weeklyTotal ?? 0} mg
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">All-Time Avg</span>
              <p className="text-2xl font-bold text-white">
                {summary.allTimeAvg ?? 0} mg
              </p>
              <span className="text-xs text-gray-600">per day</span>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Buttons */}
      <div className="bg-port-card border border-port-border rounded-xl p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Quick Add
          </h3>
          <button
            onClick={() => setManagingButtons(!managingButtons)}
            className="p-1 text-gray-500 hover:text-white transition-colors"
            title="Manage product buttons"
          >
            <Settings size={14} />
          </button>
        </div>

        {managingButtons ? (
          <div className="space-y-3">
            {productButtons.map((btn, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-port-bg rounded-lg p-2">
                {editingButtonIdx === idx ? (
                  <>
                    <input
                      type="text"
                      value={buttonForm.name}
                      onChange={e => setButtonForm({ ...buttonForm, name: e.target.value })}
                      className="flex-1 bg-port-card border border-port-border rounded px-2 py-1 text-sm text-white"
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      value={buttonForm.mgPerUnit}
                      onChange={e => setButtonForm({ ...buttonForm, mgPerUnit: e.target.value })}
                      className="w-20 bg-port-card border border-port-border rounded px-2 py-1 text-sm text-white"
                      placeholder="mg"
                      step="0.1"
                    />
                    <button onClick={saveEditButton} className="p-1 text-port-success hover:text-white"><Check size={14} /></button>
                    <button onClick={cancelEditButton} className="p-1 text-gray-500 hover:text-white"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-white">{btn.name}</span>
                    <span className="text-xs text-gray-500">{btn.mgPerUnit} mg</span>
                    <button onClick={() => startEditButton(idx)} className="p-1 text-gray-500 hover:text-white"><Pencil size={12} /></button>
                    <button onClick={() => handleRemoveButton(idx)} className="p-1 text-gray-500 hover:text-port-error"><Trash2 size={12} /></button>
                  </>
                )}
              </div>
            ))}
            <form onSubmit={handleAddButton} className="flex items-center gap-2 pt-2 border-t border-port-border">
              <input
                type="text"
                value={buttonForm.name}
                onChange={e => setButtonForm({ ...buttonForm, name: e.target.value })}
                className="flex-1 bg-port-card border border-port-border rounded px-2 py-1 text-sm text-white"
                placeholder="New product name"
              />
              <input
                type="number"
                value={buttonForm.mgPerUnit}
                onChange={e => setButtonForm({ ...buttonForm, mgPerUnit: e.target.value })}
                className="w-20 bg-port-card border border-port-border rounded px-2 py-1 text-sm text-white"
                placeholder="mg"
                step="0.1"
              />
              <button type="submit" className="px-3 py-1 min-h-[40px] bg-port-accent/10 text-port-accent rounded text-sm hover:bg-port-accent/20">
                <Plus size={14} />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {productButtons.map((btn, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAdd(btn)}
                disabled={logging}
                className="px-3 py-2 min-h-[40px] bg-port-bg border border-port-border rounded-lg text-sm text-white hover:border-port-accent transition-colors disabled:opacity-50"
              >
                {btn.name}
              </button>
            ))}
          </div>
        )}

        {/* Date selector */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-gray-500">Date:</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-port-bg border border-port-border rounded px-2 py-1 text-sm text-white"
          />
          {date !== today && (
            <button
              onClick={() => setDate(today)}
              className="text-xs text-port-accent hover:underline"
            >
              Reset to today
            </button>
          )}
        </div>
      </div>

      {/* Custom Entry Form */}
      <div className="bg-port-card border border-port-border rounded-xl p-4 sm:p-6">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
          Custom Entry
        </h3>
        <form onSubmit={handleCustomAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">Product</label>
            <input
              type="text"
              value={product}
              onChange={e => setProduct(e.target.value)}
              className="w-full bg-port-bg border border-port-border rounded px-3 py-2 text-sm text-white"
              placeholder="e.g. Stokes Pick"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs text-gray-500 mb-1">mg/unit</label>
            <input
              type="number"
              value={mgPerUnit}
              onChange={e => setMgPerUnit(e.target.value)}
              className="w-full bg-port-bg border border-port-border rounded px-3 py-2 text-sm text-white"
              placeholder="5"
              step="0.1"
              min="0.1"
              required
            />
          </div>
          <div className="w-20">
            <label className="block text-xs text-gray-500 mb-1">Count</label>
            <input
              type="number"
              value={count}
              onChange={e => setCount(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-port-bg border border-port-border rounded px-3 py-2 text-sm text-white"
              min="1"
            />
          </div>
          <button
            type="submit"
            disabled={logging || !mgPerUnit}
            className="px-4 py-2 min-h-[40px] bg-port-accent text-white rounded-lg text-sm font-medium hover:bg-port-accent/80 disabled:opacity-50 flex items-center gap-1"
          >
            <Plus size={14} />
            Log
          </button>
        </form>
      </div>

      {/* Chart */}
      <NicotineChart onRefreshKey={refreshKey} onViewChange={setChartView} />

      {/* Correlation Chart */}
      {correlationData && (
        <NicotineHealthCorrelation data={correlationData} range={chartView} />
      )}

      {/* Entry History */}
      {visibleEntries.length > 0 && (
        <div className="bg-port-card border border-port-border rounded-xl p-4 sm:p-6">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
            History
          </h3>
          <div className="space-y-4">
            {visibleEntries.map(entry => (
              <div key={entry.date} className="border-b border-port-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{entry.date}</span>
                    <span className="text-xs text-gray-600">{dayOfWeek(entry.date)}</span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {entry.nicotine?.totalMg ?? 0} mg
                  </span>
                </div>

                {entry.nicotine?.items?.map((item, idx) => {
                  const key = `${entry.date}:${idx}`;
                  const isEditing = editingKey === key;

                  return (
                    <div key={idx} className="flex flex-wrap items-center gap-2 py-1 pl-4 text-sm">
                      {isEditing ? (
                        <>
                          <input
                            type="date"
                            value={editForm.date}
                            onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                            className="bg-port-bg border border-port-border rounded px-2 py-1 text-sm text-white"
                          />
                          <input
                            type="text"
                            value={editForm.product}
                            onChange={e => setEditForm({ ...editForm, product: e.target.value })}
                            className="flex-1 min-w-[80px] bg-port-bg border border-port-border rounded px-2 py-1 text-sm text-white"
                          />
                          <input
                            type="number"
                            value={editForm.mgPerUnit}
                            onChange={e => setEditForm({ ...editForm, mgPerUnit: e.target.value })}
                            className="w-20 bg-port-bg border border-port-border rounded px-2 py-1 text-sm text-white"
                            step="0.1"
                          />
                          <span className="text-gray-500">x</span>
                          <input
                            type="number"
                            value={editForm.count}
                            onChange={e => setEditForm({ ...editForm, count: e.target.value })}
                            className="w-16 bg-port-bg border border-port-border rounded px-2 py-1 text-sm text-white"
                            min="1"
                          />
                          <button onClick={saveEdit} className="p-1 text-port-success hover:text-white"><Check size={14} /></button>
                          <button onClick={cancelEdit} className="p-1 text-gray-500 hover:text-white"><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-gray-300">{item.product || 'Unnamed'}</span>
                          <span className="text-gray-500">{item.mgPerUnit} mg</span>
                          {item.count > 1 && <span className="text-gray-600">x{item.count}</span>}
                          <span className="text-white font-medium">{Math.round(item.mgPerUnit * (item.count || 1) * 100) / 100} mg</span>
                          <button onClick={() => startEdit(entry.date, idx, item)} className="p-1 text-gray-600 hover:text-white"><Pencil size={12} /></button>
                          <button onClick={() => handleRemove(entry.date, idx)} className="p-1 text-gray-600 hover:text-port-error"><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {hasMore && (
            <button
              onClick={() => setVisibleDays(v => v + DAYS_PER_PAGE)}
              className="mt-4 w-full py-2 text-sm text-port-accent hover:underline"
            >
              Load more...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
