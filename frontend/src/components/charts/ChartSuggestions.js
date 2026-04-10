import React, { useState, useEffect } from 'react';
import { Box, Typography, Tabs, Tab } from '@mui/material';
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as LineChartIcon,
  BubbleChart as ScatterIcon,
  TableChart as TableIcon,
  AutoAwesome as AutoIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import ChartDetector from '../../services/ChartDetector';
import AutoChart from './AutoChart';
import ChartBuilder from './ChartBuilder';

const getChartIcon = (type) => {
  if (type === 'pie')     return <PieChartIcon  sx={{ fontSize: 12 }} />;
  if (type === 'line')    return <LineChartIcon sx={{ fontSize: 12 }} />;
  if (type === 'scatter') return <ScatterIcon   sx={{ fontSize: 12 }} />;
  return <BarChartIcon sx={{ fontSize: 12 }} />;
};

const ChartSuggestions = ({ data, columns, sql, serverSuggestions, onViewChange }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedChart, setSelectedChart] = useState(null);
  const [viewMode, setViewMode] = useState('chart');
  const [chartMode, setChartMode] = useState(0);
  const [usingServerSuggestions, setUsingServerSuggestions] = useState(false);

  // ── Custom chart state (lifted so it survives Chart↔Table switches) ──
  const [customChartType, setCustomChartType] = useState('bar');
  const [customXAxis, setCustomXAxis]         = useState('');
  const [customYAxis, setCustomYAxis]         = useState([]);
  const [customChartConfig, setCustomChartConfig] = useState(null);

  useEffect(() => {
    if (serverSuggestions && serverSuggestions.length > 0) {
      setSuggestions(serverSuggestions);
      setSelectedChart(serverSuggestions[0]);
      setViewMode('chart');
      setChartMode(0);
      setUsingServerSuggestions(true);
      return;
    }

    if (data && data.length > 0 && columns && columns.length > 0) {
      const chartSuggestions = ChartDetector.analyze(data, columns, { sql });
      setSuggestions(chartSuggestions);
      setUsingServerSuggestions(false);
      
      if (chartSuggestions.length > 0) {
        setSelectedChart(chartSuggestions[0]);
        setViewMode('chart');
        setChartMode(0);
      } else {
        setViewMode('table');
      }
    } else {
      setSuggestions([]);
      setSelectedChart(null);
      setViewMode('table');
      setUsingServerSuggestions(false);
    }
  }, [data, columns, sql, serverSuggestions]);

  const handleChartSelect = (chart) => {
    setSelectedChart(chart);
    setViewMode('chart');
    setChartMode(0);
  };

  const handleViewModeChange = (_, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode);
      if (onViewChange) onViewChange(newMode);
    }
  };

  const handleChartModeChange = (_, newMode) => { setChartMode(newMode); };

  if (!data || data.length === 0) return null;

  return (
    <Box sx={{ bgcolor: '#252526', borderBottom: '1px solid #3c3c3c' }}>

      {/* ── Header bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1, pb: 0.5, gap: 1 }}>
        <Typography sx={{
          fontSize: 11, fontWeight: 600, color: '#6e6e6e',
          letterSpacing: 0.8, textTransform: 'uppercase', flex: 1,
        }}>
          Visualizations
        </Typography>

        {/* Chart | Table toggle */}
        <Box sx={{ display: 'flex', border: '1px solid #3c3c3c', borderRadius: 0.5, overflow: 'hidden' }}>
          {[
            { mode: 'chart', icon: <BarChartIcon sx={{ fontSize: 13 }} />, label: 'Chart' },
            { mode: 'table', icon: <TableIcon    sx={{ fontSize: 13 }} />, label: 'Table' },
          ].map(({ mode, icon, label }, i) => (
            <Box key={mode} onClick={() => handleViewModeChange(null, mode)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1.25, py: 0.4, cursor: 'pointer', fontSize: 11,
                bgcolor: viewMode === mode ? '#37373d' : 'transparent',
                color:   viewMode === mode ? '#d4d4d4' : '#6e6e6e',
                '&:hover': { color: '#d4d4d4' },
                borderRight: i === 0 ? '1px solid #3c3c3c' : 'none',
              }}>
              {icon}{label}
            </Box>
          ))}
        </Box>
      </Box>

      {viewMode === 'chart' && (
        <>
          {/* ── Auto | Custom tabs ── */}
          <Tabs value={chartMode} onChange={handleChartModeChange}
            TabIndicatorProps={{ style: { display: 'none' } }}
            sx={{
              minHeight: 28, px: 1,
              '& .MuiTabs-flexContainer': { gap: 0.25 },
              '& .MuiTab-root': {
                minHeight: 26, py: 0, px: 1.25, fontSize: 11,
                textTransform: 'none', color: '#6e6e6e',
                '&.Mui-selected': { color: '#d4d4d4', bgcolor: '#37373d', borderRadius: 0.5 },
              },
            }}>
            <Tab icon={<AutoIcon sx={{ fontSize: 12 }} />} iconPosition="start" label="Auto Suggestions" />
            <Tab icon={<TuneIcon sx={{ fontSize: 12 }} />} iconPosition="start" label="Custom Chart" />
          </Tabs>

          <Box sx={{ px: 1.5, pb: 1 }}>
            {chartMode === 0 && (
              <>
                {suggestions.length === 0 ? (
                  <Box sx={{ py: 1.5 }}>
                    <Typography sx={{ fontSize: 12, color: '#9a9a9a' }}>
                      No automatic visualizations — try a{' '}
                      <code style={{ color: '#e9c46a', fontFamily: 'monospace' }}>GROUP BY</code>{' '}
                      with aggregates, or use Custom Chart.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Typography sx={{ fontSize: 11, color: '#6e6e6e', mb: 0.75, mt: 0.5 }}>
                      Smart suggestions based on your data:
                    </Typography>

                    {/* Suggestion chips */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {suggestions.map((chart, index) => {
                        const isActive = selectedChart === chart;
                        return (
                          <Box key={index} onClick={() => handleChartSelect(chart)}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 0.5,
                              px: 1, py: 0.3, cursor: 'pointer', borderRadius: 0.5,
                              fontSize: 11, border: '1px solid',
                              borderColor: isActive ? '#9c6fde' : '#3c3c3c',
                              bgcolor:     isActive ? '#9c6fde18' : 'transparent',
                              color:       isActive ? '#b48aee' : '#9a9a9a',
                              '&:hover': { borderColor: '#555', color: '#d4d4d4' },
                              transition: 'all 0.12s',
                            }}>
                            {getChartIcon(chart.type)}
                            {(chart.type || 'CHART').toUpperCase()}
                          </Box>
                        );
                      })}
                    </Box>

                    {selectedChart && (
                      <Box sx={{ mb: 0.75, pl: 1, borderLeft: '2px solid #9c6fde44' }}>
                        <Typography sx={{ fontSize: 11, color: '#d4d4d4', fontStyle: 'italic' }}>
                          {selectedChart.description}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: '#6e6e6e' }}>
                          {selectedChart.reason}
                          {usingServerSuggestions && (
                            <span style={{ color: '#89d185', marginLeft: 6 }}>(server)</span>
                          )}
                        </Typography>
                      </Box>
                    )}

                    {selectedChart && <AutoChart data={data} config={selectedChart} />}
                  </>
                )}
              </>
            )}

            {chartMode === 1 && (
              <ChartBuilder
                data={data}
                columns={columns}
                chartType={customChartType}
                setChartType={setCustomChartType}
                xAxis={customXAxis}
                setXAxis={setCustomXAxis}
                yAxis={customYAxis}
                setYAxis={setCustomYAxis}
                chartConfig={customChartConfig}
                setChartConfig={setCustomChartConfig}
              />
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default ChartSuggestions;
