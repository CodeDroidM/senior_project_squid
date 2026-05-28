import React, { useState } from 'react';
import {
  Box,
  Typography,
} from '@mui/material';
import ChartSuggestions from './charts/ChartSuggestions';
import QueryTable from './QueryTable';

const ResultsTable = ({ queryResult, initialView = 'table' }) => {
  const [viewMode, setViewMode] = useState(initialView);

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

      {/* When ChartSuggestions is in 'chart' mode we want to render the chart
          (handled by ChartSuggestions) and always show the table below it. When
          in 'table' mode we only show the table. */}
      {viewMode === 'chart' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ px: 1.5, pb: 1 }}>
            {/* Chart area is rendered inside ChartSuggestions */}
          </Box>
          <QueryTable data={data} columns={columns} />
        </Box>
      )}

      {viewMode === 'table' && (
        <QueryTable data={data} columns={columns} />
      )}
    </Box>
  );
};

export default ResultsTable;
