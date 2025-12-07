import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';

import ObjectsPanel from './components/ObjectsPanel';
import TabbedSqlEditor from './components/TabbedSqlEditor';
import OutputPanel from './components/OutputPanel';
import Console from './components/Console';
import ResultsTable from './components/ResultsTable';
import Login from './components/Login';
import { connectToAgent, validateUser, connectToAccp, getAccessibleObjects, executeQuery, disconnectFromAgent, setAuthToken } from './api';
import * as XLSX from 'xlsx';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
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

  const addLog = (message, type = 'info') => {
    const newLog = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  const handleLogin = async (creds) => {
    setConnecting(true);
    setError(null);
    setCredentials(creds);
    addLog('Connecting to DbSrc Agent...', 'info');

    try {
      addLog(`Authenticating user ${creds.username}...`, 'info');
      const validationResult = await validateUser(creds.username, creds.password);
      addLog('User validated successfully', 'success');
      
      addLog(`Connecting to ACCP ${creds.accp_id}...`, 'info');
      const connectionResult = await connectToAccp(creds.accp_id, creds.host_ip || '127.0.0.1');
      
      setConnected(true);
      setIsLoggedIn(true);
      addLog(`Successfully connected to ACCP ${creds.accp_id}`, 'success');
      setSnackbar({ open: true, message: 'Connected successfully!', severity: 'success' });

      const credentialsWithTimestamp = {
        username: creds.username,
        password: creds.password, // Note: In production, consider security implications
        accp_id: creds.accp_id,
        host_ip: creds.host_ip || '127.0.0.1',
        loginTime: new Date().toISOString(),
        expiresInHours: connectionResult.expires_in_hours || 24,
      };
      localStorage.setItem('squid_credentials', JSON.stringify(credentialsWithTimestamp));

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
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = async () => {
    if (!credentials) {
      setSnackbar({ open: true, message: 'Please login first', severity: 'warning' });
      return;
    }
    await handleLogin(credentials);
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
      
      localStorage.removeItem('squid_credentials');
      sessionStorage.removeItem('squid_credentials');
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

      setQueryResult(result);
      addLog('Query executed successfully', 'success');
      setSnackbar({ open: true, message: 'Query executed successfully', severity: 'success' });
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

  const handleClearLogs = () => {
    setLogs([]);
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
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<results>\n';
        data.forEach((row) => {
          xml += '  <row>\n';
          columns.forEach((col) => {
            const value = row[col] !== null && row[col] !== undefined ? String(row[col]) : '';
            const escapedValue = value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
            xml += `    <${col}>${escapedValue}</${col}>\n`;
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

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  useEffect(() => {
    let isMounted = true;
    
    const attemptAutoLogin = async () => {
      const storedCreds = localStorage.getItem('squid_credentials');
      if (!storedCreds || !isMounted) return;

      try {
        const creds = JSON.parse(storedCreds);
        
        if (creds.loginTime && creds.expiresInHours) {
          const loginTime = new Date(creds.loginTime);
          const expiresInHours = creds.expiresInHours || 24;
          const expirationTime = new Date(loginTime.getTime() + expiresInHours * 60 * 60 * 1000);
          
          if (new Date() > expirationTime) {
            localStorage.removeItem('squid_credentials');
            if (isMounted) addLog('Session expired, please login again', 'warning');
            return;
          }
        }

        if (isMounted) {
          addLog('Auto-login with saved credentials...', 'info');
          setConnecting(true);
        }
        
        const { loginTime: _loginTime, expiresInHours: _expiresInHours, ...apiCreds } = creds;
        
        try {
          if (isMounted) setCredentials(apiCreds);
          
          const validationResult = await validateUser(apiCreds.username, apiCreds.password);
          
          if (!isMounted) return;
          addLog('User validated successfully', 'success');
          
          const connectionResult = await connectToAccp(apiCreds.accp_id, apiCreds.host_ip || '127.0.0.1');
          
          if (!isMounted) return;
          
          setConnected(true);
          setIsLoggedIn(true);
          addLog(`Successfully reconnected to ACCP ${apiCreds.accp_id}`, 'success');

          // Update credentials with new timestamp
          const credentialsWithTimestamp = {
            ...apiCreds,
            loginTime: new Date().toISOString(),
            expiresInHours: connectionResult.expires_in_hours || 24,
          };
          localStorage.setItem('squid_credentials', JSON.stringify(credentialsWithTimestamp));
          
          // Fetch accessible objects
          setLoadingObjects(true);
          const accessResult = await getAccessibleObjects();
          if (isMounted) {
            setAccessData(accessResult);
            setLoadingObjects(false);
            addLog('Loaded accessible objects', 'success');
          }
        } catch (err) {
          // Auto-login failed, clear storage and show login screen
          localStorage.removeItem('squid_credentials');
          if (isMounted) {
            const errorMsg = err.response?.data?.detail || err.message || 'Auto-login failed';
            addLog(`Auto-login failed: ${errorMsg}`, 'warning');
            setConnected(false);
            setIsLoggedIn(false);
          }
        } finally {
          if (isMounted) setConnecting(false);
        }
      } catch (e) {
        console.error('Failed to parse stored credentials', e);
        localStorage.removeItem('squid_credentials');
        if (isMounted) setConnecting(false);
      }
    };

    attemptAutoLogin();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - only run once on mount

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* AppBar */}
        <AppBar position="static" elevation={2}>
          <Toolbar>
            <StorageIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              SQUID - SQL Query Interface for Data
            </Typography>

            {connected ? (
              <Typography variant="body2" sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    mr: 1,
                  }}
                />
                Connected
              </Typography>
            ) : (
              <Button
                color="inherit"
                onClick={handleConnect}
                disabled={connecting}
                startIcon={connecting ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </Button>
            )}

            <IconButton color="inherit" onClick={handleMenuOpen}>
              <SettingsIcon />
            </IconButton>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
              <MenuItem onClick={handleMenuClose}>
                <SettingsIcon sx={{ mr: 1 }} />
                Settings
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleDisconnect();
                  handleMenuClose();
                }}
              >
                <LogoutIcon sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Main Content Area */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
            {/* Left Panel - Objects */}
            <Box sx={{ width: '20%', minWidth: '250px', height: '100%', overflow: 'hidden' }}>
              <ObjectsPanel
                accessData={accessData}
                onTableClick={handleTableClick}
                loading={loadingObjects}
                error={!connected && !loadingObjects ? error : null}
              />
            </Box>

            {/* Right Panel - Tabbed SQL Editor */}
            <Box sx={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* SQL Editor with Tabs */}
                <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <TabbedSqlEditor
                    query={query}
                    setQuery={setQuery}
                    onExecuteQuery={handleExecuteQuery}
                    queryResult={queryResult}
                    loading={loading}
                  />
                </Box>

                {/* Output Panel with Console and Results */}
                <OutputPanel
                  initialHeight={260}
                  minHeight={120}
                  maxHeight={600}
                  loading={loading}
                  result={error ? 'error' : queryResult ? 'success' : null}
                  queryResult={queryResult}
                  onExport={handleExport}
                  onRunQuery={() => handleExecuteQuery(query)}
                >
                  {/* Console View */}
                  <Console logs={logs} />
                  
                  {/* Results Table View */}
                  <ResultsTable queryResult={queryResult} />
                </OutputPanel>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;
