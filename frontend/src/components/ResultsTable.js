import React, { useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ChartSuggestions from './charts/ChartSuggestions';

const CELL_SX = {
  fontSize: 12,
  fontFamily: '"Cascadia Code","Fira Code",Consolas,monospace',
  py: '3px', px: '10px',
  borderBottom: '1px solid #2a2d2e',
  color: '#cccccc',
  whiteSpace: 'nowrap',
};

const ResultsTable = ({ queryResult }) => {
  const [viewMode, setViewMode] = useState('table');

  if (!queryResult) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#858585', fontSize: 12 }}>
          Execute a query to see results here
        </Typography>
      </Box>
    );
  }

  if (queryResult.err_code !== '0') {
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ bgcolor: '#3b1212', border: '1px solid #5a1d1d', borderRadius: 0.5, p: 1.5 }}>
          <Typography sx={{ color: '#f48771', fontSize: 12, fontFamily: 'monospace' }}>
            ✗ {queryResult.err_msg || 'Query execution failed'}
          </Typography>
          {queryResult.details?.suggestion && (
            <Typography sx={{ color: '#858585', fontSize: 11, mt: 0.5 }}>
              💡 {queryResult.details.suggestion}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  const data = queryResult.data || [];
  const columns = queryResult.columns || [];

  if (!Array.isArray(data)) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography sx={{ color: '#e9c46a', fontSize: 12 }}>
          ⚠ Invalid data format received from server (got {typeof data})
        </Typography>
      </Box>
    );
  }

  if (data.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ color: '#858585', fontSize: 12 }}>No results returned</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#1e1e1e' }}>
      <ChartSuggestions
        data={data}
        columns={columns}
        sql={queryResult.executedSql || queryResult.sql}
        serverSuggestions={queryResult.chart_suggestions}
        onViewChange={setViewMode}
      />

      {viewMode === 'table' && (
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader size="small" sx={{ minWidth: 400, borderCollapse: 'collapse' }}>
            <TableHead>
              <TableRow>
                {columns.map((col, i) => (
                  <TableCell key={i} sx={{
                    ...CELL_SX,
                    fontWeight: 600, color: '#9cdcfe',
                    bgcolor: '#252526',
                    borderBottom: '2px solid #3c3c3c',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row, ri) => (
                <TableRow key={ri} sx={{
                  bgcolor: ri % 2 === 0 ? '#1e1e1e' : '#252526',
                  '&:hover': { bgcolor: '#2a2d2e' },
                }}>
                  {columns.map((col, ci) => (
                    <TableCell key={ci} sx={CELL_SX}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : (
                        <span style={{ color: '#555', fontStyle: 'italic' }}>NULL</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#252526', borderTop: '1px solid #3c3c3c' }}>
            <Typography sx={{ color: '#858585', fontSize: 11 }}>
              {data.length} row{data.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </TableContainer>
      )}
    </Box>
  );
};

export default ResultsTable;
