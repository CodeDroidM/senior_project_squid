import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Chip,
  Divider
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as LineChartIcon,
  BubbleChart as ScatterIcon
} from '@mui/icons-material';
import ChartDetector from '../../services/ChartDetector';
import AutoChart from './AutoChart';

const ChartBuilder = ({ data, columns }) => {
  const [columnInfo, setColumnInfo] = useState([]);
  const [chartType, setChartType] = useState('bar');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState([]);
  const [chartConfig, setChartConfig] = useState(null);

  useEffect(() => {
    if (data && data.length > 0 && columns && columns.length > 0) {
      const analysis = columns.map(col => ({
        name: col,
        type: ChartDetector.detectColumnType(data, col),
        cardinality: ChartDetector.getCardinality(data, col)
      }));
      
      setColumnInfo(analysis);

      const categorical = analysis.filter(c => c.type === 'CATEGORICAL' && c.cardinality <= 20);
      const numeric = analysis.filter(c => c.type === 'NUMERIC');
      const dates = analysis.filter(c => c.type === 'DATE');

      if (dates.length > 0 && numeric.length > 0) {
        setChartType('line');
        setXAxis(dates[0].name);
        setYAxis([numeric[0].name]);
      } else if (categorical.length > 0 && numeric.length > 0) {
        const cat = categorical[0];
        if (cat.cardinality <= 8) {
          setChartType('pie');
          setXAxis(cat.name);
          setYAxis([numeric[0].name]);
        } else {
          setChartType('bar');
          setXAxis(cat.name);
          setYAxis([numeric[0].name]);
        }
      } else if (numeric.length >= 2) {
        setChartType('scatter');
        setXAxis(numeric[0].name);
        setYAxis([numeric[1].name]);
      }
    }
  }, [data, columns]);

  const handleGenerateChart = () => {
    if (!xAxis || yAxis.length === 0) return;

    const config = {
      type: chartType,
      x: xAxis,
      y: chartType === 'pie' ? yAxis[0] : yAxis,
      labels: chartType === 'pie' ? xAxis : undefined,
      values: chartType === 'pie' ? yAxis[0] : undefined,
      description: generateDescription()
    };

    if (chartType !== 'scatter' && data && data.length > 0) {
      const xCardinality = ChartDetector.getCardinality(data, xAxis);
      const needsAgg = xCardinality < data.length * 0.8;

      if (needsAgg) {
        const numericY = yAxis.filter(col => {
          const colInfo = columnInfo.find(c => c.name === col);
          return colInfo?.type === 'NUMERIC';
        });

        if (chartType === 'pie') {
          config.transform = {
            type: 'categoricalCounts',
            column: xAxis,
            top: Math.min(xCardinality, 15),
            includeOther: true
          };
        } else if (numericY.length > 0) {
          const metricLabels = numericY.map(col => `Avg ${col}`);
          config.y = metricLabels;
          config.transform = {
            type: 'aggregate',
            groupBy: xAxis,
            metrics: numericY.map(col => ({
              column: col,
              method: 'avg',
              label: `Avg ${col}`
            })),
            limit: Math.min(xCardinality, 30),
            sort: chartType === 'line' ? 'asc' : 'desc'
          };
        }
      }
    }

    setChartConfig(config);
  };

  const generateDescription = () => {
    if (chartType === 'pie') {
      return `${yAxis[0]} distribution by ${xAxis}`;
    } else if (chartType === 'line') {
      return `${yAxis.join(', ')} trend over ${xAxis}`;
    } else if (chartType === 'bar') {
      return `${yAxis.join(', ')} comparison by ${xAxis}`;
    } else if (chartType === 'scatter') {
      return `${yAxis[0]} vs ${xAxis} correlation`;
    }
    return '';
  };

  const getColumnsByType = (type) => {
    return columnInfo.filter(c => c.type === type).map(c => c.name);
  };

  const getVisualizableColumns = () => {
    return columnInfo.filter(c => {
      const name = c.name.toUpperCase();
      const isId = name.includes('ID') || name === 'ID';
      if (isId) {
        return c.cardinality <= 50;
      }
      return (c.type === 'NUMERIC' || (c.type === 'CATEGORICAL' && c.cardinality <= 50));
    }).map(c => c.name);
  };

  const getCategoricalColumns = () => {
    return columnInfo.filter(c => (c.type === 'CATEGORICAL' && c.cardinality <= 50) || (c.type === 'NUMERIC' && (c.name.toUpperCase().includes('ID') && c.cardinality <= 50))).map(c => c.name);
  };

  const getNumericColumns = () => {
    return columnInfo.filter(c => c.type === 'NUMERIC').map(c => c.name);
  };

  const getDateColumns = () => {
    return getColumnsByType('DATE');
  };

  const getAvailableXColumns = () => {
    if (chartType === 'pie' || chartType === 'bar') {
      return getCategoricalColumns().concat(getDateColumns());
    } else if (chartType === 'line') {
      return getDateColumns().concat(getCategoricalColumns());
    } else if (chartType === 'scatter') {
      return getNumericColumns();
    }
    return columns;
  };

  const getAvailableYColumns = () => {
    if (chartType === 'pie') {
      return getNumericColumns();
    } else if (chartType === 'scatter') {
      return getNumericColumns().filter(c => c !== xAxis);
    }
    return getNumericColumns();
  };

  const handleYAxisChange = (event) => {
    const value = event.target.value;
    if (chartType === 'pie') {
      setYAxis([value]);
    } else {
      setYAxis(typeof value === 'string' ? value.split(',') : value);
    }
  };

  if (!data || data.length === 0) return null;

  return (
    <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        📊 Build Your Chart
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Chart Type</InputLabel>
          <Select value={chartType} label="Chart Type" onChange={(e) => setChartType(e.target.value)}>
            <MenuItem value="bar">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BarChartIcon fontSize="small" />
                Bar Chart
              </Box>
            </MenuItem>
            <MenuItem value="pie">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PieChartIcon fontSize="small" />
                Pie Chart
              </Box>
            </MenuItem>
            <MenuItem value="line">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LineChartIcon fontSize="small" />
                Line Chart
              </Box>
            </MenuItem>
            <MenuItem value="scatter">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScatterIcon fontSize="small" />
                Scatter Plot
              </Box>
            </MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>X-Axis</InputLabel>
          <Select value={xAxis} label="X-Axis" onChange={(e) => setXAxis(e.target.value)}>
            {getAvailableXColumns().map(col => (
              <MenuItem key={col} value={col}>
                {col}
                <Chip 
                  label={columnInfo.find(c => c.name === col)?.type} 
                  size="small" 
                  sx={{ ml: 1, height: 18 }}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Y-Axis</InputLabel>
          <Select
            value={chartType === 'pie' ? (yAxis[0] || '') : yAxis}
            label="Y-Axis"
            onChange={handleYAxisChange}
            multiple={chartType !== 'pie'}
          >
            {getAvailableYColumns().map(col => (
              <MenuItem key={col} value={col}>
                {col}
                <Chip 
                  label={columnInfo.find(c => c.name === col)?.type} 
                  size="small" 
                  sx={{ ml: 1, height: 18 }}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button 
          variant="contained" 
          onClick={handleGenerateChart}
          disabled={!xAxis || yAxis.length === 0}
        >
          Generate Chart
        </Button>
      </Stack>

      {chartType === 'pie' && yAxis.length > 1 && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1 }}>
          ⚠️ Pie charts work best with a single metric. Using: {yAxis[0]}
        </Typography>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        💡 Tip: {chartType === 'bar' ? 'Compare values across categories' : 
                 chartType === 'pie' ? 'Show proportions of a total' :
                 chartType === 'line' ? 'Show trends over time or sequence' :
                 'Explore correlation between two numeric values'}
      </Typography>

      {chartConfig && (
        <>
          <Divider sx={{ my: 2 }} />
          <AutoChart data={data} config={chartConfig} />
        </>
      )}
    </Paper>
  );
};

export default ChartBuilder;
