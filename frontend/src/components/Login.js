import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { validateUser as apiValidateUser } from '../api';

export default function Login({ onLogin, initialStep = 1, initialAccps = null, initialUser = null, onSwitchAccp = null }) {
  const [step, setStep] = useState(initialStep);
  const [username, setUsername] = useState(initialUser || '');
  const [password, setPassword] = useState('');
  const [availableAccps, setAvailableAccps] = useState(initialAccps || []);
  const [selectedAccp, setSelectedAccp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [rolePassword, setRolePassword] = useState('');
  const [roleError, setRoleError] = useState(null);
  const [connectedRoleAccp, setConnectedRoleAccp] = useState(null);

  const validateUser = async () => {
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await apiValidateUser(username.trim(), password.trim());
      
      if (!data.available_accps || data.available_accps.length === 0) {
        setError('No ACCPs available for this user. Please contact your administrator.');
        return;
      }
      
      setAvailableAccps(data.available_accps);
      setStep(2);
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || e.message || 'User validation failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const connectToAccp = async (accp) => {
    // ROLE-based ACCP: go through OTP dialog first
    if (accp.accp_type === 'ROLE') {
      try {
        setLoading(true);
        setSelectedAccp(accp);
        setError(null);
        
        // Connect/switch to the ACCP — triggers the OTP email on the backend
        console.log('🔗 Connecting to ROLE-based ACCP, OTP email will be sent…');

        let connectionResult;
        if (onSwitchAccp) {
          const switchResp = await fetch('http://localhost:8000/switch-accp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accp_id: accp.accp_id, client_host: '127.0.0.1' }),
          });
          if (!switchResp.ok) {
            const err = await switchResp.json();
            throw new Error(err.detail || 'ACCP switch failed');
          }
          connectionResult = await switchResp.json();
        } else {
          const response = await fetch('http://localhost:8000/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: username,
              password: password,
              accp_id: accp.accp_id,
              host_ip: '127.0.0.1'
            })
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Connection failed');
          }
          connectionResult = await response.json();
        }
        
        setConnectedRoleAccp({
          accp_id: accp.accp_id,
          accp_name: accp.accp_name,
          role_name: accp.role_name,
          schema_name: connectionResult?.schema_name
        });
        
        setShowRoleDialog(true);
        setRolePassword('');
        setRoleError(null);
        setLoading(false);
        
      } catch (e) {
        const errorMsg = e?.response?.data?.detail || e.message || 'Connection failed';
        setError(errorMsg);
        setLoading(false);
        setSelectedAccp(null);
      }
      
      return;
    }
    
    // USER-type ACCP — connect directly
    try {
      setLoading(true);
      setSelectedAccp(accp);
      setError(null);

      if (onSwitchAccp) {
        // Switch mode: App.js will call /switch-accp
        await onSwitchAccp(accp);
      } else {
        // Normal login mode: App.js will call /connect
        await onLogin({
          username: username,
          password: password,
          accp_id: accp.accp_id,
          host_ip: '127.0.0.1'
        });
      }
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || e.message || 'Connection failed';
      setError(errorMsg);
      setLoading(false);
      setSelectedAccp(null);
    }
  };
  
  const handleRolePasswordSubmit = async () => {
    if (!rolePassword.trim()) {
      setRoleError('Please enter the ROLE password from your email');
      return;
    }
    
    if (!connectedRoleAccp) {
      setRoleError('Connection info not found. Please try connecting again.');
      return;
    }
    
    try {
      setLoading(true);
      setRoleError(null);
      
      const connectedSchema = connectedRoleAccp.schema_name;
      let derivedRoleName = connectedRoleAccp.role_name;
      
      if (!derivedRoleName && connectedSchema) {
        // Derive ROLE schema from USER schema (e.g. _U_ -> _R_)
        derivedRoleName = connectedSchema.replace(/_U_/, '_R_');
        console.log('⚠️ ROLE name not in metadata, derived from schema:', derivedRoleName);
      }
      
      if (!derivedRoleName) {
        setRoleError('Cannot determine ROLE name. Please contact your administrator.');
        setLoading(false);
        return;
      }
      
      console.log('🔐 Activating ROLE:', derivedRoleName);
      
  // Activate ROLE via backend using the password sent by email
  const response = await fetch('http://localhost:8000/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_name: derivedRoleName,
          role_password: rolePassword.trim()
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'ROLE activation failed');
      }
      
      console.log('✅ ROLE activated successfully');
      setShowRoleDialog(false);
      setLoading(false);

      if (onSwitchAccp) {
        // Notify parent that switch + ROLE activation completed. Include flag so
        // the parent knows the backend switch call already ran.
        onSwitchAccp({
          accp_id: connectedRoleAccp.accp_id,
          schema_name: connectedRoleAccp.schema_name,
          _alreadySwitched: true,
        });
      } else {
        // Normal login: notify parent that authentication is complete.
        onLogin({
          username: username,
          password: password,
          accp_id: connectedRoleAccp.accp_id,
          host_ip: '127.0.0.1'
        });
      }
      
    } catch (e) {
      const errorMsg = e?.message || 'ROLE authentication failed';
      setRoleError(errorMsg);
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Login to SQUID
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your DbSrc credentials
      </Typography>

      <TextField
        label="Username"
        fullWidth
        margin="normal"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
          setError(null);
        }}
        disabled={loading}
        required
        autoFocus
      />

      <TextField
        label="Password"
        type="password"
        fullWidth
        margin="normal"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(null);
        }}
        disabled={loading}
        required
        onKeyPress={(e) => e.key === 'Enter' && validateUser()}
      />

      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={validateUser}
        disabled={loading}
        sx={{ mt: 3, py: 1.5 }}
        startIcon={loading && <CircularProgress size={20} color="inherit" />}
      >
        {loading ? 'Validating...' : 'Continue'}
      </Button>
    </Box>
  );

  const renderStep2 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        {onSwitchAccp ? 'Switch ACCP Schema' : 'Select ACCP Schema'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {onSwitchAccp
          ? 'Choose a different database schema to connect to'
          : 'Choose which database schema you want to connect to'}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {availableAccps.map((accp) => (
          <Card 
            key={accp.accp_id}
            variant="outlined" 
            sx={{ 
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                elevation: 2,
                bgcolor: 'action.hover'
              }
            }}
            onClick={() => !loading && connectToAccp(accp)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight="medium">
                    {accp.schema_name || accp.accp_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {accp.description || 'Database schema access'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Chip 
                      label={`ACCP ${accp.accp_id}`} 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                    />
                    {accp.accp_type === 'ROLE' && (
                      <Chip 
                        label="ROLE" 
                        size="small" 
                        color="warning" 
                        icon={<LockIcon />}
                      />
                    )}
                  </Box>
                  {loading && selectedAccp?.accp_id === accp.accp_id && (
                    <CircularProgress size={20} sx={{ mt: 1 }} />
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {!onSwitchAccp && (
        <Button
          variant="text"
          onClick={() => {
            setStep(1);
            setAvailableAccps([]);
            setPassword('');
            setError(null);
          }}
          disabled={loading}
          sx={{ mt: 2 }}
        >
          Back to Login
        </Button>
      )}
    </Box>
  );

  // ── Embedded mode (Change ACCP overlay) ───────────────────────────
  if (onSwitchAccp) {
    return (
      <Box sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {renderStep2()}
        {/* ROLE dialog still needed */}
        <Dialog open={showRoleDialog} onClose={() => !loading && setShowRoleDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LockIcon color="warning" />
              <Typography variant="h6">Enter ROLE Password</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              ACCP <strong>{connectedRoleAccp?.accp_name}</strong> requires ROLE authentication
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="caption">
                <strong>📧 Email Sent!</strong><br />
                An email with the ROLE name and password has been sent to your registered email address.
                Please enter the password below.
              </Typography>
            </Alert>
            {roleError && <Alert severity="error" sx={{ mb: 2 }}>{roleError}</Alert>}
            <TextField
              label="ROLE Password from Email"
              type="password"
              fullWidth
              value={rolePassword}
              onChange={(e) => setRolePassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRolePasswordSubmit()}
              disabled={loading}
              autoFocus
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowRoleDialog(false)} disabled={loading}>Cancel</Button>
            <Button variant="contained" onClick={handleRolePasswordSubmit}
              disabled={loading || !rolePassword.trim()}
              startIcon={loading && <CircularProgress size={20} />}>
              {loading ? 'Activating…' : 'Activate ROLE'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: 500, maxWidth: '100%' }} elevation={6}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#ffffff', borderRadius: '50%', p: 1.5, mb: 1, boxShadow: '0 4px 20px rgba(156,111,222,0.4)' }}>
            <Box component="img" src="/squid.png" alt="SQUID Logo" sx={{ width: 160, height: 160, objectFit: 'contain' }} />
          </Box>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            SQUID
          </Typography>
          <Typography variant="body2" color="text.secondary">
            SQL Query Interface for Data
          </Typography>
        </Box>

        <Stepper activeStep={step - 1} sx={{ mb: 3 }}>
          <Step>
            <StepLabel>User Validation</StepLabel>
          </Step>
          <Step>
            <StepLabel>Select Schema</StepLabel>
          </Step>
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}

      </Paper>
      
      {/* ROLE Password Dialog - OTP Style */}
      <Dialog open={showRoleDialog} onClose={() => !loading && setShowRoleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LockIcon color="warning" />
            <Typography variant="h6">Enter ROLE Password</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            ACCP <strong>{connectedRoleAccp?.accp_name}</strong> requires ROLE authentication
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="caption">
              <strong>📧 Email Sent!</strong><br />
              An email with the ROLE name and password has been sent to your registered email address.<br />
              Please check your email and enter the password below.
            </Typography>
          </Alert>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="caption">
              <strong>💡 OTP-Style Security</strong><br />
              The password changes daily for security. You'll need a new one each time you connect.
            </Typography>
          </Alert>
          {roleError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {roleError}
            </Alert>
          )}
          <TextField
            label="ROLE Password from Email"
            type="password"
            fullWidth
            value={rolePassword}
            onChange={(e) => setRolePassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleRolePasswordSubmit()}
            disabled={loading}
            autoFocus
            placeholder="Enter password from email"
            helperText={connectedRoleAccp?.role_name ? 
              `Will activate ROLE: ${connectedRoleAccp.role_name}` : 
              'ROLE will be activated automatically'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRoleDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleRolePasswordSubmit} 
            disabled={loading || !rolePassword.trim()}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? 'Activating ROLE...' : 'Activate ROLE'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
