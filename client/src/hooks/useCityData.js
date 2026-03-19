import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as api from '../services/api';
import socket from '../services/socket';

export const useCityData = () => {
  const [apps, setApps] = useState([]);
  const [cosAgents, setCosAgents] = useState([]);
  const [cosStatus, setCosStatus] = useState({ running: false });
  const [runningAgents, setRunningAgents] = useState([]);
  const [eventLogs, setEventLogs] = useState([]);
  const [reviewCounts, setReviewCounts] = useState({ total: 0, alert: 0, todo: 0, briefing: 0, cos: 0 });
  const [instances, setInstances] = useState({ self: null, peers: [], syncStatus: null });
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchApps = useCallback(async () => {
    const data = await api.getApps().catch(() => []);
    setApps(data);
    return data;
  }, []);

  const fetchAll = useCallback(async () => {
    const [appsData, agents, cosAgentsData, status, reviewData, instanceData] = await Promise.all([
      api.getApps().catch(() => []),
      api.getRunningAgents().catch(() => []),
      api.getCosAgents().catch(() => []),
      api.getCosStatus().catch(() => ({ running: false })),
      api.getReviewCounts().catch(() => ({ total: 0, alert: 0, todo: 0, briefing: 0, cos: 0 })),
      api.getInstances().catch(() => ({ self: null, peers: [], syncStatus: null })),
    ]);

    setApps(appsData);
    setRunningAgents(agents);
    setCosAgents(cosAgentsData);
    setCosStatus(status);
    setReviewCounts(reviewData);
    setInstances(instanceData);
    setLoading(false);
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map();
    const allAgents = [...(cosAgents || [])];

    allAgents.forEach(agent => {
      if (!agent.workspacePath) return;
      const matchedApp = apps.find(app =>
        app.repoPath && agent.workspacePath.startsWith(app.repoPath)
      );
      if (matchedApp) {
        const existing = map.get(matchedApp.id) || { app: matchedApp, agents: [] };
        existing.agents.push(agent);
        map.set(matchedApp.id, existing);
      }
    });

    return map;
  }, [apps, cosAgents]);

  useEffect(() => {
    fetchAll();

    const subscribe = () => socket.emit('cos:subscribe');
    if (socket.connected) subscribe();
    socket.on('connect', subscribe);

    const handleAppsChanged = () => fetchApps();
    socket.on('apps:changed', handleAppsChanged);

    const handleAgentSpawned = (data) => {
      setCosAgents(prev => [...prev, data]);
      fetchAll();
    };
    socket.on('cos:agent:spawned', handleAgentSpawned);

    const handleAgentUpdated = (updatedAgent) => {
      setCosAgents(prev => prev.map(a => a.agentId === updatedAgent.agentId ? updatedAgent : a));
    };
    socket.on('cos:agent:updated', handleAgentUpdated);

    const handleAgentCompleted = () => {
      fetchAll();
    };
    socket.on('cos:agent:completed', handleAgentCompleted);

    const handleCosLog = (data) => {
      setEventLogs(prev => [...prev, { ...data, timestamp: data.timestamp || Date.now() }].slice(-50));
    };
    socket.on('cos:log', handleCosLog);

    const handleCosStatus = (data) => {
      setCosStatus(prev => ({ ...prev, running: data.running }));
    };
    socket.on('cos:status', handleCosStatus);

    pollRef.current = setInterval(async () => {
      const agents = await api.getRunningAgents().catch(() => []);
      setRunningAgents(agents);
    }, 10000);

    return () => {
      socket.emit('cos:unsubscribe');
      socket.off('connect', subscribe);
      socket.off('apps:changed', handleAppsChanged);
      socket.off('cos:agent:spawned', handleAgentSpawned);
      socket.off('cos:agent:updated', handleAgentUpdated);
      socket.off('cos:agent:completed', handleAgentCompleted);
      socket.off('cos:log', handleCosLog);
      socket.off('cos:status', handleCosStatus);
      clearInterval(pollRef.current);
    };
  }, [fetchAll, fetchApps]);

  return {
    apps,
    cosAgents,
    cosStatus,
    runningAgents,
    eventLogs,
    agentMap,
    reviewCounts,
    instances,
    loading,
    connected: socket.connected,
  };
};
