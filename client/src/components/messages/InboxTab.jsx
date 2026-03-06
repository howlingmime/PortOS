import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Search, RefreshCw, ChevronRight } from 'lucide-react';
import * as api from '../../services/api';
import MessageDetail from './MessageDetail';

export default function InboxTab({ accounts }) {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (selectedAccount) params.accountId = selectedAccount;
    if (debouncedSearch) params.search = debouncedSearch;
    const result = await api.getMessageInbox(params).catch(() => ({ messages: [], total: 0 }));
    setMessages(result.messages || []);
    setTotal(result.total || 0);
    setLoading(false);
  }, [selectedAccount, debouncedSearch]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  if (selectedMessage) {
    return (
      <MessageDetail
        message={selectedMessage}
        accounts={accounts}
        onBack={() => setSelectedMessage(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="w-full pl-9 pr-3 py-2 bg-port-bg border border-port-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-port-accent"
          />
        </div>
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="px-3 py-2 bg-port-bg border border-port-border rounded-lg text-sm text-white focus:outline-none focus:border-port-accent"
        >
          <option value="">All accounts</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          onClick={fetchMessages}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="text-sm text-gray-500">{total} messages</div>

      {messages.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <Mail size={48} className="mx-auto mb-4 opacity-50" />
          <p>No messages yet</p>
          <p className="text-sm mt-1">Add an account and sync to get started</p>
        </div>
      )}

      <div className="space-y-1">
        {messages.map((msg) => (
          <button
            key={msg.id}
            onClick={() => setSelectedMessage(msg)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-port-card ${
              msg.isRead ? 'opacity-70' : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm truncate ${msg.isRead ? 'text-gray-400' : 'text-white font-medium'}`}>
                  {msg.from?.name || msg.from?.email || 'Unknown'}
                </span>
                <span className="text-xs text-gray-600 shrink-0">
                  {msg.date ? new Date(msg.date).toLocaleDateString() : ''}
                </span>
              </div>
              <div className={`text-sm truncate ${msg.isRead ? 'text-gray-500' : 'text-gray-300'}`}>
                {msg.subject || '(no subject)'}
              </div>
              <div className="text-xs text-gray-600 truncate">
                {msg.bodyText?.substring(0, 100) || ''}
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-600 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
