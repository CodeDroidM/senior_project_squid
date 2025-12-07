import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorageIcon from '@mui/icons-material/Storage';

const AccpSelection = ({ username, availableAccps, onAccpSelect, onBack, loading = false, error = null }) => {
  const [selectedAccp, setSelectedAccp] = useState(null);

  const handleAccpClick = (accp) => {
    setSelectedAccp(accp);
  };

  const handleConnect = () => {
    if (selectedAccp && onAccpSelect) {
      onAccpSelect(selectedAccp);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Connecting to ACCP...
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4 }}>
          {/* Logo and Title */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <StorageIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              sQUID
            </Typography>
            <Typography variant="body2" color="text.secondary">
              SQL Query Interface for Data
            </Typography>
          </Box>

          {/* Stepper */}
          <Stepper activeStep={1} sx={{ mb: 4 }}>
            <Step completed>
              <StepLabel>User Validation</StepLabel>
            </Step>
            <Step>
              <StepLabel>Select Schema</StepLabel>
            </Step>
          </Stepper>

          {/* Title */}
          <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
            Select ACCP Schema
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose which database schema you want to connect to
          </Typography>

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* ACCP List */}
          {availableAccps && availableAccps.length > 0 ? (
            <Paper variant="outlined" sx={{ mb: 3, maxHeight: 400, overflow: 'auto' }}>
              <List>
                {availableAccps.map((accp, index) => (
                  <ListItem key={accp.accp_id} disablePadding divider={index < availableAccps.length - 1}>
                    <ListItemButton
                      selected={selectedAccp?.accp_id === accp.accp_id}
                      onClick={() => handleAccpClick(accp)}
                      sx={{
                        '&.Mui-selected': {
                          backgroundColor: 'primary.light',
                          '&:hover': {
                            backgroundColor: 'primary.light',
                          },
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {accp.accp_name || accp.schema_name || `ACCP ${accp.accp_id}`}
                            </Typography>
                            <Chip label={`ACCP ${accp.accp_id}`} size="small" color="primary" />
                          </Box>
                        }
                        secondary={accp.description || accp.schema_name || `Schema for ACCP ${accp.accp_id}`}
                      />
                      {selectedAccp?.accp_id === accp.accp_id && (
                        <CheckCircleIcon color="primary" sx={{ ml: 2 }} />
                      )}
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          ) : (
            <Alert severity="warning" sx={{ mb: 3 }}>
              No ACCPs available. Please contact your administrator.
            </Alert>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={onBack} fullWidth>
              BACK TO LOGIN
            </Button>
            <Button
              variant="contained"
              onClick={handleConnect}
              disabled={!selectedAccp || loading}
              fullWidth
            >
              {loading ? <CircularProgress size={24} /> : 'CONNECT'}
            </Button>
          </Box>

          {/* Footer */}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              H2M Authentication • DbSrc Agent Integration
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default AccpSelection;
