import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PieChartIcon from '@mui/icons-material/PieChart';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const ChartArea = ({ chartData }) => {
  const [chartType, setChartType] = useState('bar');

  const handleChartTypeChange = (event, newType) => {
    if (newType !== null) {
      setChartType(newType);
    }
  };

  const prepareChartData = () => {
    if (!chartData || !chartData.rows || chartData.rows.length === 0) {
      return null;
    }

    const { columns, rows } = chartData;
    
    // Try to detect numeric columns
    const numericColumns = columns.filter((col) => {
      const firstValue = rows[0][col];
      return !isNaN(parseFloat(firstValue)) && isFinite(firstValue);
    });

    // Try to detect label column (first non-numeric or first column)
    const labelColumn = columns.find((col) => {
      const firstValue = rows[0][col];
      return isNaN(parseFloat(firstValue)) || !isFinite(firstValue);
    }) || columns[0];

    // Extract labels
    const labels = rows.map((row) => String(row[labelColumn] || ''));

    // Generate datasets for each numeric column
    const datasets = numericColumns.map((col, index) => {
      const colors = [
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 99, 132, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
      ];

      return {
        label: col,
        data: rows.map((row) => parseFloat(row[col]) || 0),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length].replace('0.8', '1'),
        borderWidth: 2,
      };
    });

    return {
      labels,
      datasets,
    };
  };

  const data = prepareChartData();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Query Results Visualization',
      },
    },
  };

  const renderChart = () => {
    if (!data) {
      return (
        <Alert severity="info">
          No data to visualize. Execute a query and click "Visualize" to see charts.
        </Alert>
      );
    }

    switch (chartType) {
      case 'line':
        return <Line data={data} options={chartOptions} />;
      case 'pie':
        // For pie charts, use only the first dataset
        const pieData = {
          labels: data.labels,
          datasets: data.datasets.length > 0 ? [data.datasets[0]] : [],
        };
        return <Pie data={pieData} options={chartOptions} />;
      case 'bar':
      default:
        return <Bar data={data} options={chartOptions} />;
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ p: 2, bgcolor: 'secondary.main', color: 'white' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChartIcon />
          Data Visualization
        </Typography>
      </Box>

      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={handleChartTypeChange}
          size="small"
          fullWidth
        >
          <ToggleButton value="bar">
            <BarChartIcon sx={{ mr: 1 }} />
            Bar
          </ToggleButton>
          <ToggleButton value="line">
            <ShowChartIcon sx={{ mr: 1 }} />
            Line
          </ToggleButton>
          <ToggleButton value="pie">
            <PieChartIcon sx={{ mr: 1 }} />
            Pie
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            height: '100%',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderChart()}
        </Paper>
      </Box>
    </Box>
  );
};

export default ChartArea;
