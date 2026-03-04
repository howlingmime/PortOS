import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useSocket } from '../hooks/useSocket';
import { RefreshCw, Power, PowerOff, FolderOpen, ChevronDown } from 'lucide-react';

const QUICK_COMMANDS = [
  { label: 'claude', command: 'claude --dangerously-skip-permissions' },
  { label: 'git status', command: 'git status' },
  { label: 'git pull', command: 'git pull --rebase --autostash' },
  { label: 'npm test', command: 'npm test' },
  { label: 'npm run dev', command: 'npm run dev' },
];

// Read a CSS custom property as hex (e.g., '--port-bg' → '#0f0f0f')
const getThemeHex = (varName) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!raw) return '#000000';
  const parts = raw.split(' ').map(Number);
  if (parts.length !== 3) return '#000000';
  return '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
};

export default function Shell() {
  const [searchParams, setSearchParams] = useSearchParams();
  const terminalRef = useRef(null);
  const termInstanceRef = useRef(null);
  const fitAddonRef = useRef(null);
  const sessionIdRef = useRef(null);
  const initialOptsRef = useRef(null);
  const socket = useSocket();
  const [connected, setConnected] = useState(false);
  const [appFolders, setAppFolders] = useState([]);
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Read query params once on mount for initial session options
  useEffect(() => {
    if (initialOptsRef.current) return;
    const cwd = searchParams.get('cwd');
    const cmd = searchParams.get('cmd');
    if (cwd || cmd) {
      initialOptsRef.current = { cwd, cmd };
      // Clear query params from URL so restart/refresh starts a plain shell
      setSearchParams({}, { replace: true });
    } else {
      initialOptsRef.current = {};
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch app folders from the managed apps list
  useEffect(() => {
    fetch('/api/apps')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(apps => setAppFolders(
        (apps || [])
          .filter(a => a.repoPath)
          .map(a => ({ name: a.name, path: a.repoPath }))
          .sort((a, b) => a.name.localeCompare(b.name))
      ))
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Send a command string to the active shell session
  const sendCommand = useCallback((cmd) => {
    if (!socket || !sessionIdRef.current) return;
    socket.emit('shell:input', { sessionId: sessionIdRef.current, data: cmd + '\n' });
    termInstanceRef.current?.focus();
  }, [socket]);

  // Initialize terminal once
  useEffect(() => {
    if (!terminalRef.current || termInstanceRef.current) return;

    const bg = getThemeHex('--port-bg');
    const fg = getThemeHex('--port-text');
    const accent = getThemeHex('--port-accent');
    const card = getThemeHex('--port-card');
    const error = getThemeHex('--port-error');
    const success = getThemeHex('--port-success');
    const warning = getThemeHex('--port-warning');

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Roboto Mono for Powerline", "MesloLGS NF", "MesloLGS Nerd Font", "Hack Nerd Font", "FiraCode Nerd Font", "JetBrainsMono Nerd Font", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: bg,
        foreground: fg,
        cursor: accent,
        cursorAccent: bg,
        selectionBackground: accent + '40',
        black: card,
        red: error,
        green: success,
        yellow: warning,
        blue: accent,
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: fg,
        brightBlack: '#404040',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      scrollback: 5000,
      allowProposedApi: true
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);

    // Defer initial fit to next frame for proper sizing
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      term.dispose();
      termInstanceRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && termInstanceRef.current) {
        fitAddonRef.current.fit();
        // Notify server of resize if we have an active session
        if (socket && sessionIdRef.current) {
          socket.emit('shell:resize', {
            sessionId: sessionIdRef.current,
            cols: termInstanceRef.current.cols,
            rows: termInstanceRef.current.rows
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [socket]);

  // Handle terminal input
  useEffect(() => {
    if (!termInstanceRef.current || !socket) return;

    const disposable = termInstanceRef.current.onData((data) => {
      if (sessionIdRef.current) {
        socket.emit('shell:input', { sessionId: sessionIdRef.current, data });
      }
    });

    return () => disposable.dispose();
  }, [socket]);

  const startSession = useCallback(() => {
    if (!socket) return;
    if (termInstanceRef.current) {
      termInstanceRef.current.clear();
      termInstanceRef.current.writeln('\x1b[36mStarting shell session...\x1b[0m');
    }
    const opts = initialOptsRef.current || {};
    const startOpts = {};
    if (opts.cwd) startOpts.cwd = opts.cwd;
    if (opts.cmd) startOpts.initialCommand = opts.cmd;
    // Only use initial opts once
    initialOptsRef.current = {};
    socket.emit('shell:start', Object.keys(startOpts).length > 0 ? startOpts : undefined);
  }, [socket]);

  const stopSession = useCallback(() => {
    if (socket && sessionIdRef.current) {
      socket.emit('shell:stop', { sessionId: sessionIdRef.current });
      sessionIdRef.current = null;
      setConnected(false);
    }
  }, [socket]);

  const restartSession = useCallback(() => {
    if (sessionIdRef.current && socket) {
      socket.emit('shell:stop', { sessionId: sessionIdRef.current });
    }
    sessionIdRef.current = null;
    setConnected(false);
    startSession();
  }, [socket, startSession]);

  // Handle socket connection and shell session events
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      startSession();
    };

    const handleShellStarted = ({ sessionId: sid }) => {
      sessionIdRef.current = sid;
      setConnected(true);
      // Send initial size
      if (termInstanceRef.current) {
        socket.emit('shell:resize', {
          sessionId: sid,
          cols: termInstanceRef.current.cols,
          rows: termInstanceRef.current.rows
        });
      }
    };

    const handleShellOutput = ({ data }) => {
      if (termInstanceRef.current) {
        termInstanceRef.current.write(data);
      }
    };

    const handleShellExit = ({ code }) => {
      setConnected(false);
      sessionIdRef.current = null;
      if (termInstanceRef.current) {
        termInstanceRef.current.writeln(`\r\n\x1b[33m[Shell exited with code ${code}]\x1b[0m`);
        termInstanceRef.current.writeln('\x1b[90mPress the restart button to start a new session\x1b[0m');
      }
    };

    const handleShellError = ({ error }) => {
      if (termInstanceRef.current) {
        termInstanceRef.current.writeln(`\r\n\x1b[31m[Error: ${error}]\x1b[0m`);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('shell:started', handleShellStarted);
    socket.on('shell:output', handleShellOutput);
    socket.on('shell:exit', handleShellExit);
    socket.on('shell:error', handleShellError);

    // Start session if already connected
    if (socket.connected) {
      startSession();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('shell:started', handleShellStarted);
      socket.off('shell:output', handleShellOutput);
      socket.off('shell:exit', handleShellExit);
      socket.off('shell:error', handleShellError);

      // Stop shell session on unmount
      if (sessionIdRef.current) {
        socket.emit('shell:stop', { sessionId: sessionIdRef.current });
        sessionIdRef.current = null;
      }
    };
  }, [socket, startSession]);

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-white">Shell</h1>
          <div className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
            connected ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-500'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <button
                onClick={restartSession}
                className="flex items-center gap-2 px-3 py-2 bg-port-border hover:bg-port-border/80 text-white rounded-lg text-sm transition-colors min-h-[40px]"
                title="Restart session"
              >
                <RefreshCw size={16} />
                Restart
              </button>
              <button
                onClick={stopSession}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors min-h-[40px]"
                title="Stop session"
              >
                <PowerOff size={16} />
                Stop
              </button>
            </>
          ) : (
            <button
              onClick={startSession}
              className="flex items-center gap-2 px-3 py-2 bg-port-accent hover:bg-port-accent/80 text-white rounded-lg text-sm transition-colors min-h-[40px]"
              title="Start session"
            >
              <Power size={16} />
              Start
            </button>
          )}
        </div>
      </div>

      {/* Quick commands toolbar */}
      {connected && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Quick command buttons */}
          {QUICK_COMMANDS.map(({ label, command }) => (
            <button
              key={label}
              onClick={() => sendCommand(command)}
              className="px-3 py-1.5 bg-port-card hover:bg-port-border text-gray-300 hover:text-white rounded text-xs font-mono transition-colors border border-port-border min-h-[40px]"
              title={command}
            >
              {label}
            </button>
          ))}

          {/* App folder cd selector */}
          <div className="relative ml-auto" ref={dropdownRef}>
            <button
              onClick={() => setFolderDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 bg-port-card hover:bg-port-border text-gray-300 hover:text-white rounded text-xs transition-colors border border-port-border min-h-[40px]"
            >
              <FolderOpen size={14} />
              cd to app
              <ChevronDown size={12} className={`transition-transform ${folderDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {folderDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 max-h-80 overflow-y-auto bg-port-card border border-port-border rounded-lg shadow-xl z-50">
                {appFolders.map(({ name, path }) => (
                  <button
                    key={name}
                    onClick={() => {
                      sendCommand(`cd ${path}`);
                      setFolderDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-mono text-gray-300 hover:bg-port-border hover:text-white transition-colors"
                  >
                    {name}
                  </button>
                ))}
                {appFolders.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500">No folders found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Terminal container */}
      <div className="flex-1 bg-port-bg rounded-lg border border-port-border overflow-hidden">
        <div
          ref={terminalRef}
          className="w-full h-full"
          style={{ padding: '8px' }}
        />
      </div>
    </div>
  );
}
