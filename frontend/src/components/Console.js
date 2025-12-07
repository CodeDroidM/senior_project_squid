import React from 'react';
import { Box, Typography } from '@mui/material';

const Console = ({ logs }) => {
  return (
    <Box
      sx={{
        height: '100%',
        bgcolor: '#1e1e1e',
        color: '#d4d4d4',
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
        fontSize: '0.8rem',
        overflow: 'auto',
        p: 2,
      }}
    >
      {logs && logs.length > 0 ? (
        logs.map((log, index) => (
          <Box
            key={`${log.id || index}-${log.timestamp}`}
            sx={{
              mb: 0.5,
              display: 'flex',
              gap: 1,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            <Typography
              component="span"
              sx={{
                color: '#858585',
                fontSize: '0.75rem',
                minWidth: '80px',
              }}
            >
              {new Date(log.timestamp).toLocaleTimeString()}
            </Typography>
            <Typography
              component="span"
              sx={{
                color:
                  log.type === 'error'
                    ? '#f48771'
                    : log.type === 'success'
                    ? '#89d185'
                    : log.type === 'warning'
                    ? '#dcdcaa'
                    : '#d4d4d4',
                fontSize: '0.8rem',
              }}
            >
              {log.message}
            </Typography>
          </Box>
        ))
      ) : (
        <Typography sx={{ color: '#858585', fontStyle: 'italic' }}>
          No messages yet. Execute a query to see output here.
        </Typography>
      )}
    </Box>
  );
};

export default Console;
