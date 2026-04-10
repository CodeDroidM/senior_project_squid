import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const sanitizeValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/,/g, ''));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const BarChart = ({ data, config }) => {
  const { x, y } = config;
  const isHorizontal = config.type === 'horizontalBar';
  const isStacked = config.type === 'stackedBar' || config.stacked;
  const valueAxis = isHorizontal ? 'x' : 'y';
  const categoryAxis = isHorizontal ? 'y' : 'x';
  
  const labels = data.map(row => row[x]);

  const COLORS = [
    '#9c6fde',  // violet (primary)
    '#64b5f6',  // sky blue
    '#89d185',  // green
    '#f48771',  // coral
    '#80cbc4',  // teal
    '#ce93d8',  // lavender
  ];
  
  const datasets = (Array.isArray(y) ? y : [y]).map((yColumn, index) => {
    const color = COLORS[index % COLORS.length];
    return {
      label: yColumn,
      data: data.map(row => {
        const value = sanitizeValue(row[yColumn]);
        return Number.isFinite(value) ? value : null;
      }),
      backgroundColor: color + 'cc',
      borderColor: color,
      borderWidth: 1,
      borderRadius: isHorizontal ? 0 : 3,
      stack: isStacked ? 'total' : undefined,
    };
  });

  const chartData = { labels, datasets };

  const DARK_PLUGINS = {
    legend: {
      position: 'top',
      labels: { color: '#d4d4d4', font: { size: 12, family: '"Segoe UI",sans-serif' }, boxWidth: 12, padding: 16 },
    },
    title: {
      display: true,
      text: config.description || `${Array.isArray(y) ? y.join(', ') : y} by ${x}`,
      color: '#d4d4d4',
      font: { size: 13, weight: '500', family: '"Segoe UI",sans-serif' },
      padding: { bottom: 12 },
    },
    tooltip: {
      backgroundColor: '#2d2d2d',
      borderColor: '#3c3c3c',
      borderWidth: 1,
      titleColor: '#d4d4d4',
      bodyColor: '#9a9a9a',
      callbacks: {
        label: (ctx) => {
          let label = ctx.dataset.label ? `${ctx.dataset.label}: ` : '';
          const parsed = isHorizontal ? ctx.parsed.x : ctx.parsed.y;
          label += (parsed !== null && Number.isFinite(parsed))
            ? new Intl.NumberFormat('en-US').format(parsed)
            : 'N/A';
          return label;
        },
      },
    },
  };

  const DARK_SCALE = {
    grid: { color: '#2e2e2e', drawBorder: false },
    ticks: { color: '#9a9a9a', font: { size: 11 } },
    border: { color: '#3c3c3c' },
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: isHorizontal ? 'y' : 'x',
    plugins: DARK_PLUGINS,
    scales: {
      [valueAxis]: {
        ...DARK_SCALE,
        beginAtZero: true,
        stacked: isStacked,
        ticks: {
          ...DARK_SCALE.ticks,
          callback: (v) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(v),
        },
      },
      [categoryAxis]: {
        ...DARK_SCALE,
        stacked: isStacked,
        ticks: {
          ...DARK_SCALE.ticks,
          maxRotation: isHorizontal ? 0 : 40,
          minRotation: 0,
        },
      },
    },
  };

  return (
    <div style={{ height: '340px', padding: '8px 16px 16px' }}>
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default BarChart;
