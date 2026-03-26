import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';
import * as api from '../services/api';

const PRIORITY_COLORS = {
  Highest: 'text-red-400',
  High: 'text-orange-400',
  Medium: 'text-yellow-400',
  Low: 'text-blue-400',
  Lowest: 'text-gray-400'
};

function ProgressBar({ value, max, color = 'bg-port-accent' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-port-border rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-port-accent' }) {
  return (
    <div className="bg-port-card border border-port-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function TicketRow({ ticket }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 hover:bg-port-border/30 rounded text-sm">
      <a
        href={ticket.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-port-accent hover:underline font-mono text-xs shrink-0"
      >
        {ticket.key}
      </a>
      <span className="text-white truncate flex-1">{ticket.summary}</span>
      {ticket.storyPoints != null && (
        <span className="text-xs bg-port-border rounded-full px-1.5 py-0.5 text-gray-400 shrink-0">
          {ticket.storyPoints}pt
        </span>
      )}
      <span className={`text-xs shrink-0 ${PRIORITY_COLORS[ticket.priority] || 'text-gray-400'}`}>
        {ticket.priority}
      </span>
      <span className="text-xs text-gray-500 shrink-0 w-24 truncate">{ticket.assignee}</span>
    </div>
  );
}

function TicketSection({ title, tickets, icon: Icon, iconColor, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  if (!tickets?.length) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-1.5 px-2 hover:bg-port-border/30 rounded"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} className={iconColor} />
        <span className="text-sm font-medium text-white">{title}</span>
        <span className="text-xs text-gray-500 ml-auto">{tickets.length}</span>
      </button>
      {open && (
        <div className="ml-2 border-l border-port-border pl-2 mt-1">
          {tickets.map(t => <TicketRow key={t.key} ticket={t} />)}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, onClick, isSelected }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? 'bg-port-accent/10 border-port-accent'
          : 'bg-port-card border-port-border hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white">{report.appName || report.appId}</span>
        <span className="text-xs text-gray-500">{report.date}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="text-port-success">{report.summary.done} done</span>
        <span className="text-port-accent">{report.summary.inProgress} in progress</span>
        <span className="text-gray-500">{report.summary.todo} to do</span>
        <span className="ml-auto">{report.summary.completionRate}%</span>
      </div>
    </button>
  );
}

function ReportDetail({ report }) {
  if (!report) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Select a report to view details
      </div>
    );
  }

  const { summary, byAssignee, tickets } = report;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{report.appName || report.appId}</h3>
          <p className="text-sm text-gray-400">
            {report.projectKey} &middot; {report.date} &middot; Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard icon={BarChart3} label="Total Tickets" value={summary.totalTickets} />
        <StatCard icon={CheckCircle} label="Done" value={summary.done} color="text-port-success" sub={`${summary.completedPoints} pts`} />
        <StatCard icon={Clock} label="In Progress" value={summary.inProgress} color="text-port-accent" sub={`${summary.inProgressPoints} pts`} />
        <StatCard icon={AlertCircle} label="To Do" value={summary.todo} color="text-gray-400" sub={`${summary.remainingPoints - summary.inProgressPoints} pts`} />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span>Sprint Progress</span>
          <span>{summary.completionRate}% ({summary.completedPoints}/{summary.totalPoints} pts)</span>
        </div>
        <ProgressBar value={summary.completedPoints} max={summary.totalPoints} color="bg-port-success" />
      </div>

      {Object.keys(byAssignee).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
            <Users size={14} /> By Assignee
          </h4>
          <div className="space-y-1.5">
            {Object.entries(byAssignee)
              .sort((a, b) => (b[1].done + b[1].inProgress) - (a[1].done + a[1].inProgress))
              .map(([name, stats]) => (
                <div key={name} className="flex items-center gap-3 text-sm px-2 py-1 bg-port-card rounded border border-port-border">
                  <span className="text-white w-32 truncate">{name}</span>
                  <span className="text-port-success text-xs">{stats.done}d</span>
                  <span className="text-port-accent text-xs">{stats.inProgress}ip</span>
                  <span className="text-gray-500 text-xs">{stats.todo}td</span>
                  <span className="text-xs text-gray-400 ml-auto">{stats.points} pts</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div>
        <TicketSection title="In Progress" tickets={tickets.inProgress} icon={Clock} iconColor="text-port-accent" defaultOpen={true} />
        <TicketSection title="To Do" tickets={tickets.todo} icon={AlertCircle} iconColor="text-gray-400" />
        <TicketSection title="Done (Sprint)" tickets={tickets.done} icon={CheckCircle} iconColor="text-port-success" />
        <TicketSection title="Recently Completed (7 days)" tickets={tickets.recentlyCompleted} icon={CheckCircle} iconColor="text-green-400" />
      </div>
    </div>
  );
}

export default function JiraReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [apps, setApps] = useState([]);

  const filterAppId = searchParams.get('app') || '';

  useEffect(() => {
    loadReports();
    loadApps();
  }, []);

  const loadApps = async () => {
    const allApps = await api.getApps();
    const jiraApps = (allApps || []).filter(a => a.jira?.enabled);
    setApps(jiraApps);
  };

  const loadReports = async () => {
    setLoading(true);
    const result = await api.getJiraReports();
    setReports(result || []);
    setLoading(false);
  };

  const handleGenerate = async (appId = null) => {
    setGenerating(true);
    const result = await api.generateJiraReport(appId);
    if (result) {
      toast.success(appId ? 'Report generated' : `Generated ${Array.isArray(result) ? result.length : 1} report(s)`);
      await loadReports();
      if (!Array.isArray(result) && result.appId) {
        setSelectedReport(result);
      }
    }
    setGenerating(false);
  };

  const handleSelectReport = async (reportMeta) => {
    const full = await api.getJiraReport(reportMeta.appId, reportMeta.date);
    if (full) setSelectedReport(full);
  };

  const handleFilterApp = (appId) => {
    if (appId) {
      setSearchParams({ app: appId });
    } else {
      setSearchParams({});
    }
    setSelectedReport(null);
  };

  const filteredReports = filterAppId
    ? reports.filter(r => r.appId === filterAppId)
    : reports;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-port-accent" />
          <h1 className="text-lg font-bold text-white">JIRA Status Reports</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterAppId}
            onChange={e => handleFilterApp(e.target.value)}
            className="bg-port-card border border-port-border rounded px-2 py-1.5 text-sm text-white"
          >
            <option value="">All Apps</option>
            {apps.map(app => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
          <button
            onClick={() => handleGenerate(filterAppId || null)}
            disabled={generating}
            className="flex items-center gap-1.5 bg-port-accent hover:bg-blue-600 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-port-accent" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <FileText size={48} className="mb-3 opacity-30" />
          <p>No reports yet. Generate your first report above.</p>
          {apps.length === 0 && (
            <p className="text-xs mt-2">Enable JIRA on an app first (Apps &rarr; Edit &rarr; JIRA)</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2 lg:col-span-1 max-h-[calc(100vh-160px)] overflow-y-auto pr-1">
            {filteredReports.map(r => (
              <ReportCard
                key={`${r.appId}-${r.date}`}
                report={r}
                onClick={() => handleSelectReport(r)}
                isSelected={selectedReport?.appId === r.appId && selectedReport?.date === r.date}
              />
            ))}
          </div>
          <div className="lg:col-span-2 bg-port-bg border border-port-border rounded-lg p-4 max-h-[calc(100vh-160px)] overflow-y-auto">
            <ReportDetail report={selectedReport} />
          </div>
        </div>
      )}
    </div>
  );
}
