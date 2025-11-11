'use client';

import { useEffect, useState } from 'react';

export default function OAuthDebugLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const storedLogs = localStorage.getItem('oauth_debug_logs');
    if (storedLogs) {
      try {
        setLogs(JSON.parse(storedLogs));
      } catch (e) {
        setLogs([{ message: 'Failed to parse logs', error: String(e) }]);
      }
    }
  }, []);

  const clearLogs = () => {
    localStorage.removeItem('oauth_debug_logs');
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">OAuth Debug Logs</h1>
        <button
          onClick={clearLogs}
          className="mb-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Clear Logs
        </button>
        
        {logs.length === 0 ? (
          <p className="text-slate-400">No logs yet. Try logging in with Google.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className={`p-3 rounded font-mono text-sm ${
                  log.severity === 'ERROR'
                    ? 'bg-red-900 text-red-100'
                    : 'bg-slate-800 text-slate-100'
                }`}
              >
                <div className="text-xs text-slate-400">{log.timestamp}</div>
                <div>{log.message}</div>
                {log.data && (
                  <pre className="mt-2 text-xs overflow-auto max-h-40 bg-black p-2 rounded">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
                {log.error && (
                  <div className="mt-2 text-xs text-red-300">{log.error}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
