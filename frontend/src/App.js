import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Snackbar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Divider,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import LogoutIcon from '@mui/icons-material/Logout';
import SyncIcon from '@mui/icons-material/Sync';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import ObjectsPanel from './components/ObjectsPanel';
import TabbedSqlEditor from './components/TabbedSqlEditor';
import OutputPanel from './components/OutputPanel';
import Console from './components/Console';
import ResultsTable from './components/ResultsTable';
import Login from './components/Login';
import { validateUser, connectToAccp, getAccessibleObjects, executeQuery, disconnectFromAgent, setAuthToken, switchAccp, getSessionInfo } from './api';
import * as XLSX from 'xlsx';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:   { main: '#9c6fde' },
    secondary: { main: '#89d185' },
    background: {
      default: '#1e1e1e',
      paper:   '#252526',
    },
    text: {
      primary:   '#d4d4d4',
      secondary: '#9a9a9a',
    },
    divider: '#3c3c3c',
    success: { main: '#89d185' },
    error:   { main: '#f48771' },
    warning: { main: '#e9c46a' },
  },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    fontSize: 13,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#1e1e1e', color: '#d4d4d4' },
        '*::-webkit-scrollbar':       { width: 8, height: 8 },
        '*::-webkit-scrollbar-track': { background: '#1e1e1e' },
        '*::-webkit-scrollbar-thumb': { background: '#424242', borderRadius: 4 },
        '*::-webkit-scrollbar-thumb:hover': { background: '#555' },
      },
    },
    MuiAppBar:  { styleOverrides: { root: { backgroundColor: '#2d2d2d', boxShadow: 'none', borderBottom: '1px solid #3c3c3c' } } },
    MuiToolbar: { styleOverrides: { root: { minHeight: '36px !important', paddingLeft: 12, paddingRight: 8 } } },
    MuiButton:  { styleOverrides: { root: { textTransform: 'none', fontSize: 12 } } },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 4, padding: 4 } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: 13 } } },
  },
});

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [accessData, setAccessData] = useState(null);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [switchingAccp, setSwitchingAccp] = useState(false);
  const [switchAccpData, setSwitchAccpData] = useState(null);

  const addLog = (message, type = 'info') => {
    const newLog = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  // Ensure the browser tab title shows SQUID (overrides cached index.html title)
  useEffect(() => {
    document.title = 'SQUID';
  }, []);

  const handleLogin = async (creds) => {
    setError(null);
    setCredentials(creds);
    addLog('Connecting to DbSrc Agent...', 'info');

    try {
      addLog(`Authenticating user ${creds.username}...`, 'info');
      await validateUser(creds.username, creds.password);
      addLog('User validated successfully', 'success');
      
      addLog(`Connecting to ACCP ${creds.accp_id}...`, 'info');
      const connectionResult = await connectToAccp(creds.accp_id, creds.host_ip || '127.0.0.1');
      
      setConnected(true);
      setIsLoggedIn(true);
      addLog(`Successfully connected to ACCP ${creds.accp_id}`, 'success');
      setSnackbar({ open: true, message: 'Connected successfully!', severity: 'success' });

      const sessionInfo = {
        username: creds.username,
        accp_id: creds.accp_id,
        host_ip: creds.host_ip || '127.0.0.1',
        loginTime: new Date().toISOString(),
        expiresInHours: connectionResult.expires_in_hours || 24,
      };
      sessionStorage.setItem('squid_session', JSON.stringify(sessionInfo));

      addLog('Loading accessible objects...', 'info');
      setLoadingObjects(true);
      const accessResult = await getAccessibleObjects();
      setAccessData(accessResult);
      setLoadingObjects(false);
      addLog('Loaded accessible objects', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Connection failed';
      setError(errorMsg);
      addLog(`Connection failed: ${errorMsg}`, 'error');
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
      throw err;
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectFromAgent();
      setConnected(false);
      setIsLoggedIn(false);
      setAccessData(null);
      setQueryResult(null);
      setLoadingObjects(false);
      setCredentials(null);
      
      sessionStorage.removeItem('squid_session');
      setAuthToken(null);
      
      addLog('Disconnected from DbSrc Agent', 'info');
      setSnackbar({ open: true, message: 'Disconnected successfully', severity: 'info' });
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Disconnect failed';
      addLog(`Disconnect failed: ${errorMsg}`, 'error');
    }
  };

  const handleExecuteQuery = async (sql) => {
    setLoading(true);
    setError(null);
    addLog(`Executing query: ${sql.substring(0, 50)}...`, 'info');

    try {
      const result = await executeQuery(sql);
      
      if (result.err_code !== '0') {
        throw new Error(result.err_msg || 'Query execution failed');
      }

      setQueryResult({ ...result, executedSql: sql });
      addLog('Query executed successfully', 'success');
      setSnackbar({ open: true, message: 'Query executed successfully', severity: 'success' });

      // Save to query history
      const accpKey = `squid_queries_${credentials?.accp_id || 'default'}`;
      try {
        const existing = JSON.parse(localStorage.getItem(accpKey) || '[]');
        const entry = { id: Date.now(), sql: sql.trim(), timestamp: new Date().toISOString() };
        const updated = [entry, ...existing.filter(e => e.sql !== sql.trim())].slice(0, 50);
        localStorage.setItem(accpKey, JSON.stringify(updated));
      } catch (_) { /* storage quota — ignore */ }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Query execution failed';
      setError(errorMsg);
      addLog(`Query failed: ${errorMsg}`, 'error');
      setSnackbar({ open: true, message: errorMsg, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (sampleQuery) => {
    setQuery(sampleQuery);
    addLog(`Loaded sample query for table`, 'info');
  };

  const handleExport = (format) => {
    if (!queryResult || !queryResult.data) {
      setSnackbar({ open: true, message: 'No data to export', severity: 'warning' });
      return;
    }

    const data = queryResult.data;
    const columns = queryResult.columns || [];

    try {
      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Query Results');
        XLSX.writeFile(wb, `query_results_${Date.now()}.xlsx`);
        addLog('Exported to Excel', 'success');
      } else if (format === 'json') {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_results_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addLog('Exported to JSON', 'success');
      } else if (format === 'xml') {
        const sanitizeTag = (name) => {
          let tag = String(name).replace(/[^a-zA-Z0-9_.-]/g, '_');
          if (/^[^a-zA-Z_]/.test(tag)) tag = '_' + tag;
          return tag || '_col';
        };
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<results>\n';
        data.forEach((row) => {
          xml += '  <row>\n';
          columns.forEach((col) => {
            const tag = sanitizeTag(col);
            const value = row[col] !== null && row[col] !== undefined ? String(row[col]) : '';
            const escapedValue = value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
            xml += `    <${tag}>${escapedValue}</${tag}>\n`;
          });
          xml += '  </row>\n';
        });
        xml += '</results>';
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_results_${Date.now()}.xml`;
        a.click();
        URL.revokeObjectURL(url);
        addLog('Exported to XML', 'success');
      }
      setSnackbar({ open: true, message: `Exported as ${format.toUpperCase()}`, severity: 'success' });
    } catch (err) {
      addLog(`Export failed: ${err.message}`, 'error');
      setSnackbar({ open: true, message: 'Export failed', severity: 'error' });
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleRefreshSchema = async () => {
    handleMenuClose();
    if (!connected) return;
    addLog('Refreshing accessible schema objects…', 'info');
    setLoadingObjects(true);
    try {
      const accessResult = await getAccessibleObjects();
      setAccessData(accessResult);
      addLog('Schema refreshed', 'success');
      setSnackbar({ open: true, message: 'Schema refreshed', severity: 'success' });
    } catch (err) {
      addLog(`Schema refresh failed: ${err.message}`, 'error');
    } finally {
      setLoadingObjects(false);
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // ── Change ACCP ──
  const handleOpenSwitchAccp = async () => {
    handleMenuClose();
    try {
      const info = await getSessionInfo();
      setSwitchAccpData({ accps: info.available_accps, username: info.username });
      setSwitchingAccp(true);
    } catch (err) {
      addLog('Could not fetch ACCP list — try logging out and back in.', 'error');
      setSnackbar({ open: true, message: 'Session expired — please logout and login again', severity: 'error' });
    }
  };

  const handleSwitchAccpSelect = async (accp) => {
    try {
      let schemaName = accp.schema_name;
      if (!accp._alreadySwitched) {
        const result = await switchAccp(accp.accp_id, credentials?.host_ip || '127.0.0.1');
        schemaName = result.schema_name;
      }
      setCredentials(prev => ({ ...prev, accp_id: accp.accp_id, schema_name: schemaName }));
      try {
        const stored = JSON.parse(sessionStorage.getItem('squid_session') || '{}');
        stored.accp_id = accp.accp_id;
        sessionStorage.setItem('squid_session', JSON.stringify(stored));
      } catch (_) { /* ignore */ }
      addLog(`Switched to ACCP ${accp.accp_id} (${schemaName || accp.accp_id})`, 'success');
      setSnackbar({ open: true, message: `Switched to ${schemaName || accp.accp_id}`, severity: 'success' });
      setSwitchingAccp(false);
      setSwitchAccpData(null);
      setLoadingObjects(true);
      try {
        const accessResult = await getAccessibleObjects();
        setAccessData(accessResult);
        setQueryResult(null);
      } finally {
        setLoadingObjects(false);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Switch failed';
      addLog(`ACCP switch failed: ${msg}`, 'error');
      throw err;
    }
  };

  useEffect(() => {
    let isMounted = true;

    localStorage.removeItem('squid_credentials');
    
    const attemptSessionRestore = async () => {
      const storedSession = sessionStorage.getItem('squid_session');
      if (!storedSession || !isMounted) return;

      try {
        const session = JSON.parse(storedSession);
        
        // Check expiration
        if (session.loginTime && session.expiresInHours) {
          const loginTime = new Date(session.loginTime);
          const expiresInHours = session.expiresInHours || 24;
          const expirationTime = new Date(loginTime.getTime() + expiresInHours * 60 * 60 * 1000);
          
          if (new Date() > expirationTime) {
            sessionStorage.removeItem('squid_session');
            if (isMounted) addLog('Session expired, please login again', 'warning');
            return;
          }
        }

        if (isMounted) {
          addLog('Checking server session...', 'info');
        }
        
        try {
          const info = await getSessionInfo();
          
          if (!isMounted) return;

          const restoredCreds = {
            username: info.username || session.username,
            accp_id: session.accp_id,
            host_ip: session.host_ip || '127.0.0.1',
          };
          setCredentials(restoredCreds);
          setConnected(true);
          setIsLoggedIn(true);
          addLog(`Session restored for ${restoredCreds.username} on ACCP ${restoredCreds.accp_id}`, 'success');

          const updatedSession = {
            ...session,
            loginTime: new Date().toISOString(),
          };
          sessionStorage.setItem('squid_session', JSON.stringify(updatedSession));
          
          setLoadingObjects(true);
          const accessResult = await getAccessibleObjects();
          if (isMounted) {
            setAccessData(accessResult);
            setLoadingObjects(false);
            addLog('Loaded accessible objects', 'success');
          }
        } catch (err) {
          sessionStorage.removeItem('squid_session');
          if (isMounted) {
            const errorMsg = err.response?.data?.detail || err.message || 'Session expired';
            addLog(`Session restore failed: ${errorMsg}`, 'warning');
            setConnected(false);
            setIsLoggedIn(false);
          }
        } finally {
          if (isMounted) setLoadingObjects(false);
        }
      } catch (e) {
        console.error('Failed to parse stored session', e);
        sessionStorage.removeItem('squid_session');
      }
    };

    attemptSessionRestore();
    
    return () => {
      isMounted = false;
    };
  }, []);

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', bgcolor: '#1e1e1e' }}>

        {/* ── Title Bar ─────────────────────────────────────────────── */}
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.12)', borderRadius: '8px', p: 0.4, mr: 1, flexShrink: 0 }}>
              <Box component="img" src="/squid.png" alt="SQUID Logo" sx={{ width: 34, height: 34, objectFit: 'contain', display: 'block' }} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#d4d4d4', letterSpacing: 0.5 }}>
              SQUID
            </Typography>
            <Typography variant="caption" sx={{ ml: 1, color: '#6e6e6e' }}>
              SQL Query Interface for Data
            </Typography>

            <Box sx={{ flex: 1 }} />

            {/* connection badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1,
              bgcolor: connected ? 'rgba(137,209,133,0.1)' : 'rgba(244,135,113,0.1)',
              border: '1px solid', borderColor: connected ? '#89d18540' : '#f4877140',
              borderRadius: 1, px: 1, py: 0.25 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: connected ? '#89d185' : '#f48771' }} />
              <Typography variant="caption" sx={{ color: connected ? '#89d185' : '#f48771', fontSize: 11 }}>
                {connected ? '+ Connected' : 'Disconnected'}
              </Typography>
            </Box>

            <Tooltip title="Options">
              <IconButton size="small" onClick={handleMenuOpen} sx={{ color: '#6e6e6e', '&:hover': { color: '#d4d4d4' } }}>
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
              PaperProps={{ sx: { bgcolor: '#2d2d2d', border: '1px solid #3c3c3c', minWidth: 220, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' } }}>
              <Box sx={{ px: 1.5, py: 0.75 }}>
                <Typography sx={{ fontSize: 10, color: '#6e6e6e', letterSpacing: 1, textTransform: 'uppercase' }}>
                  ACCP {credentials?.accp_id}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#9a9a9a' }}>
                  {credentials?.username}
                </Typography>
              </Box>
              <Divider sx={{ borderColor: '#3c3c3c', my: 0.5 }} />
              <MenuItem onClick={handleRefreshSchema}
                sx={{ fontSize: 13, color: '#d4d4d4', gap: 1, '&:hover': { bgcolor: '#3a3a3a' } }}>
                <SyncIcon sx={{ fontSize: 15, color: '#89d185' }} />
                <Box>
                  <Typography sx={{ fontSize: 13, color: '#d4d4d4', lineHeight: 1.3 }}>Refresh Schema</Typography>
                  <Typography sx={{ fontSize: 10, color: '#6e6e6e', lineHeight: 1.2 }}>Re-fetch tables and views</Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={handleOpenSwitchAccp}
                sx={{ fontSize: 13, color: '#9c6fde', gap: 1, '&:hover': { bgcolor: '#2a2040' } }}>
                <SyncIcon sx={{ fontSize: 15, color: '#9c6fde' }} />
                <Box>
                  <Typography sx={{ fontSize: 13, color: '#9c6fde', lineHeight: 1.3 }}>Change ACCP Schema</Typography>
                  <Typography sx={{ fontSize: 10, color: '#6e6e6e', lineHeight: 1.2 }}>Return to ACCP selection</Typography>
                </Box>
              </MenuItem>
              <Divider sx={{ borderColor: '#3c3c3c', my: 0.5 }} />
              <MenuItem onClick={() => { handleDisconnect(); handleMenuClose(); }}
                sx={{ fontSize: 13, color: '#f48771', gap: 1, '&:hover': { bgcolor: '#3a2020' } }}>
                <LogoutIcon sx={{ fontSize: 15 }} />
                <Box>
                  <Typography sx={{ fontSize: 13, color: '#f48771', lineHeight: 1.3 }}>Logout</Typography>
                  <Typography sx={{ fontSize: 10, color: '#6e6e6e', lineHeight: 1.2 }}>Disconnect and sign out</Typography>
                </Box>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* ── Main Layout ───────────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

          {/* Left Sidebar - Explorer */}
          <Box sx={{ width: 240, flexShrink: 0, borderRight: '1px solid #3c3c3c', bgcolor: '#252526', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Sidebar header */}
            <Box sx={{ px: 2, py: 0.75, borderBottom: '1px solid #3c3c3c' }}>
              <Typography variant="caption" sx={{ color: '#bbb', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 }}>
                Database Objects
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <ObjectsPanel
                accessData={accessData}
                onTableClick={handleTableClick}
                loading={loadingObjects}
                error={!connected && !loadingObjects ? error : null}
              />
            </Box>
          </Box>

          {/* Editor + Output */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TabbedSqlEditor
              query={query}
              setQuery={setQuery}
              onExecuteQuery={handleExecuteQuery}
              queryResult={queryResult}
              loading={loading}
              accpId={credentials?.accp_id}
            />
            <OutputPanel
              initialHeight={280}
              minHeight={120}
              maxHeight={2000}
              loading={loading}
              result={error ? 'error' : queryResult ? 'success' : null}
              queryResult={queryResult}
              onExport={handleExport}
              onRunQuery={() => handleExecuteQuery(query)}
            >
              <Console logs={logs} />
              <ResultsTable queryResult={queryResult} />
            </OutputPanel>
          </Box>
        </Box>

        {/* ── Status Bar ────────────────────────────────────────────── */}
        <Box sx={{ height: 22, bgcolor: '#2a2a2a', borderTop: '1px solid #3c3c3c', display: 'flex', alignItems: 'center', px: 1.5, gap: 2, flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: connected ? '#89d185' : '#9a9a9a', fontSize: 11 }}>
            {connected ? `⬤  ACCP ${credentials?.accp_id}` : '○  Not connected'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6e6e6e', fontSize: 11 }}>
            {credentials?.username ? `User: ${credentials.username}` : ''}
          </Typography>
          {loading && (
            <Typography variant="caption" sx={{ color: '#b48aee', fontSize: 11 }}>
              ⟳  Running query…
            </Typography>
          )}
        </Box>

        {/* Notifications */}
        <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}
            sx={{ bgcolor: '#252526', border: '1px solid #3c3c3c', color: '#cccccc',
              '& .MuiAlert-icon': { color: snackbar.severity === 'success' ? '#89d185' : snackbar.severity === 'error' ? '#f48771' : '#4fc3f7' } }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>

      {/* ── Change ACCP overlay ─────────────────────────────────────── */}
      <Dialog
        open={switchingAccp}
        onClose={() => { setSwitchingAccp(false); setSwitchAccpData(null); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1e1e1e', border: '1px solid #3c3c3c', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' } }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid #3c3c3c', pb: 1 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#d4d4d4' }}>
            Switch ACCP Schema
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#6e6e6e', mt: 0.25 }}>
            Currently connected as {credentials?.username}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {switchAccpData && (
            <Login
              onLogin={() => {}}
              initialStep={2}
              initialAccps={switchAccpData.accps}
              initialUser={switchAccpData.username}
              onSwitchAccp={handleSwitchAccpSelect}
            />
          )}
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;
