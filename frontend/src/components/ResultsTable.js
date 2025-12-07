import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Alert,
} from '@mui/material';

const ResultsTable = ({ queryResult }) => {
  if (!queryResult) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Execute a query to see results here
        </Typography>
      </Box>
    );
  }

  if (queryResult.err_code !== '0') {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          <Typography variant="body2">
            <strong>Error:</strong> {queryResult.err_msg || 'Query execution failed'}
          </Typography>
          {queryResult.details && queryResult.details.suggestion && (
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              💡 {queryResult.details.suggestion}
            </Typography>
          )}
          {queryResult.details && queryResult.details.raw_length && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
              Received {queryResult.details.raw_length} bytes from server
            </Typography>
          )}
        </Alert>
      </Box>
    );
  }

  const data = queryResult.data || [];
  const columns = queryResult.columns || [];

  // Ensure data is an array
  if (!Array.isArray(data)) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="warning">
          <Typography variant="body2">
            Invalid data format received from server
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
            Expected array, got {typeof data}
          </Typography>
        </Alert>
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="info">No results returned</Alert>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0} sx={{ height: '100%', overflow: 'auto' }}>
      <Table stickyHeader size="small" sx={{ minWidth: 650 }}>
        <TableHead>
          <TableRow>
            {columns.map((col, index) => (
              <TableCell
                key={index}
                sx={{
                  fontWeight: 600,
                  bgcolor: '#f5f5f5',
                  borderBottom: 2,
                  borderColor: 'divider',
                  fontSize: '0.8rem',
                }}
              >
                {col}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow
              key={rowIndex}
              sx={{
                '&:nth-of-type(odd)': {
                  bgcolor: 'action.hover',
                },
                '&:hover': {
                  bgcolor: 'action.selected',
                },
              }}
            >
              {columns.map((col, colIndex) => (
                <TableCell key={colIndex} sx={{ fontSize: '0.75rem' }}>
                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Box sx={{ p: 1, bgcolor: '#f5f5f5', borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {data.length} row{data.length !== 1 ? 's' : ''} returned
        </Typography>
      </Box>
    </TableContainer>
  );
};

export default ResultsTable;
