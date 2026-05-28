import React from 'react';
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

const CELL_SX = {
  fontSize: 12,
  fontFamily: '"Cascadia Code","Fira Code",Consolas,monospace',
  py: '3px', px: '10px',
  borderBottom: '1px solid #2a2d2e',
  color: '#cccccc',
  whiteSpace: 'nowrap',
};

const QueryTable = ({ data = [], columns = [] }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return (
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
  );
};

export default QueryTable;
