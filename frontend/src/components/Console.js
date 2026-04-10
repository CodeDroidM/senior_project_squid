import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';

const PREFIX = {
  error:   { symbol: '✗', color: '#f48771' },
  success: { symbol: '✓', color: '#89d185' },
  warning: { symbol: '⚠', color: '#e9c46a' },
  info:    { symbol: '›', color: '#4fc3f7' },
  default: { symbol: '·', color: '#858585' },
};

const Console = ({ logs }) => {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <Box sx={{
      height: '100%', bgcolor: '#1e1e1e', color: '#d4d4d4',
      fontFamily: '"Cascadia Code","Fira Code",Consolas,monospace',
      fontSize: 12, overflow: 'auto', p: '8px 12px',
    }}>
      {logs && logs.length > 0 ? logs.map((log, index) => {
        const kind = PREFIX[log.type] || PREFIX.default;
        return (
          <Box key={`${log.id || index}-${log.timestamp}`} sx={{
            display: 'flex', gap: 1, py: '1px',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
          }}>
            {/* timestamp */}
            <Typography component="span" sx={{ color: '#555', fontSize: 11, minWidth: 70, flexShrink: 0 }}>
              {new Date(log.timestamp).toLocaleTimeString()}
            </Typography>
            {/* prefix symbol */}
            <Typography component="span" sx={{ color: kind.color, fontSize: 12, minWidth: 14, flexShrink: 0 }}>
              {kind.symbol}
            </Typography>
            {/* message */}
            <Typography component="span" sx={{ color: kind.color, fontSize: 12, wordBreak: 'break-word' }}>
              {log.message}
            </Typography>
          </Box>
        );
      }) : (
        <Typography sx={{ color: '#555', fontStyle: 'italic', fontSize: 12 }}>
          No messages yet. Execute a query to see output here.
        </Typography>
      )}
      <div ref={bottomRef} />
    </Box>
  );
};

export default Console;
