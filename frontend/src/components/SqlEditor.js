import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  ButtonGroup,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import * as XLSX from 'xlsx';

const SqlEditor = ({ query, setQuery, onExecuteQuery, queryResult, loading, error }) => {
  const [rowCount, setRowCount] = useState(0);

  // Extract column names and rows from query result
  const parseQueryResult = (result) => {
    if (!result || !result.data) return { columns: [], rows: [] };

    try {
      const parsedData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        const columns = Object.keys(parsedData[0]);
        return { columns, rows: parsedData };
      }
    } catch (e) {
      console.error('Error parsing query result:', e);
    }

    return { columns: [], rows: [] };
  };

  const { columns, rows } = parseQueryResult(queryResult);

  React.useEffect(() => {
    setRowCount(rows.length);
  }, [rows]);

  const handleRunQuery = () => {
    if (query.trim()) {
      onExecuteQuery(query);
    }
  };

  const handleExportExcel = () => {
    if (rows.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Query Results');
    XLSX.writeFile(workbook, `squid_export_${Date.now()}.xlsx`);
  };

  const handleExportJSON = () => {
    if (rows.length === 0) return;
    
    const dataStr = JSON.stringify(rows, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `squid_export_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXML = () => {
    if (rows.length === 0) return;
    
    // Simple XML generation without external library
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
    rows.forEach((row) => {
      xml += '  <row>\n';
      Object.keys(row).forEach((key) => {
        const value = row[key] !== null && row[key] !== undefined ? String(row[key]) : '';
        // Escape XML special characters
        const escapedValue = value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        xml += `    <${key}>${escapedValue}</${key}>\n`;
      });
      xml += '  </row>\n';
    });
    xml += '</data>';
    
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `squid_export_${Date.now()}.xml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      {/* SQL Editor Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          SQL Query Editor
        </Typography>
        
        {/* SQL Input */}
        <TextField
          fullWidth
          multiline
          rows={6}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your SQL query here..."
          variant="outlined"
          sx={{
            mb: 2,
            fontFamily: 'monospace',
            '& textarea': {
              fontFamily: 'monospace',
              fontSize: '14px',
            },
          }}
        />

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRunQuery}
            disabled={loading || !query.trim()}
          >
            Run Query
          </Button>

          <ButtonGroup variant="outlined" disabled={rows.length === 0}>
            <Button startIcon={<DownloadIcon />} onClick={handleExportExcel}>
              Excel
            </Button>
            <Button onClick={handleExportJSON}>JSON</Button>
            <Button onClick={handleExportXML}>XML</Button>
          </ButtonGroup>

          {rowCount > 0 && (
            <Chip
              label={`${rowCount} row${rowCount !== 1 ? 's' : ''}`}
              color="success"
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Results Table */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && queryResult && rows.length > 0 && (
          <TableContainer component={Paper} sx={{ maxHeight: '100%' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {columns.map((col) => (
                    <TableCell
                      key={col}
                      sx={{
                        fontWeight: 'bold',
                        bgcolor: 'primary.main',
                        color: 'white',
                      }}
                    >
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                      '&:hover': { bgcolor: 'action.selected' },
                    }}
                  >
                    {columns.map((col) => (
                      <TableCell key={`${idx}-${col}`}>
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!loading && queryResult && rows.length === 0 && (
          <Alert severity="info">No results found.</Alert>
        )}
      </Box>
    </Box>
  );
};

export default SqlEditor;
