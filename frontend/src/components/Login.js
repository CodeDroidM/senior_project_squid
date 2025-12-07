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
  CardActions,
  Chip,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { validateUser as apiValidateUser } from '../api';

export default function Login({ onLogin }) {
  const [step, setStep] = useState(1); // 1 = username+password, 2 = accp selection
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [availableAccps, setAvailableAccps] = useState([]);
  const [selectedAccp, setSelectedAccp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userToken, setUserToken] = useState(null);

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
      setUserToken(data.token);
      setStep(2);
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || e.message || 'User validation failed';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const connectToAccp = async (accp) => {
    try {
      setLoading(true);
      setSelectedAccp(accp);
      setError(null);
      
      // Pass the full credentials including username, password, and accp_id to onLogin
      const credentials = {
        username: username,
        password: password,
        accp_id: accp.accp_id,
        host_ip: '127.0.0.1'
      };
      
      await onLogin(credentials);
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || e.message || 'Connection failed';
      setError(errorMsg);
      setLoading(false);
      setSelectedAccp(null);
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
        Select ACCP Schema
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose which database schema you want to connect to
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
                    {accp.schema_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {accp.description || 'Database schema access'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Chip 
                    label={`ACCP ${accp.accp_id}`} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                  {loading && selectedAccp?.accp_id === accp.accp_id && (
                    <CircularProgress size={20} sx={{ mt: 1 }} />
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

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
    </Box>
  );

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
          <StorageIcon sx={{ fontSize: 60, color: 'primary.main', mb: 1 }} />
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

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
          H2M Authentication • DbSrc Agent Integration
        </Typography>
      </Paper>
    </Box>
  );
}
