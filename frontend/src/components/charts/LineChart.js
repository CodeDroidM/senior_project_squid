import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const LineChart = ({ data, config }) => {
  const { x, y } = config;
  
  const labels = data.map(row => row[x]);

  // Squid violet-based palette on dark backgrounds
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
        const value = row[yColumn];
        return typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
      }),
      borderColor: color,
      backgroundColor: color + '22',
      tension: 0.3,
      fill: false,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2,
    };
  });

  const chartData = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#d4d4d4', font: { size: 12, family: '"Segoe UI",sans-serif' }, boxWidth: 12, padding: 16 },
      },
      title: {
        display: true,
        text: config.description || `Trend of ${Array.isArray(y) ? y.join(', ') : y} over ${x}`,
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
            if (ctx.parsed.y !== null) label += new Intl.NumberFormat('en-US').format(ctx.parsed.y);
            return label;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: { color: '#2e2e2e', drawBorder: false },
        ticks: {
          color: '#9a9a9a', font: { size: 11 },
          callback: (v) => new Intl.NumberFormat('en-US', { notation: 'compact' }).format(v),
        },
        border: { color: '#3c3c3c' },
      },
      x: {
        grid: { color: '#2a2a2a', drawBorder: false },
        ticks: { color: '#9a9a9a', font: { size: 11 }, maxRotation: 40, minRotation: 0 },
        border: { color: '#3c3c3c' },
      },
    },
  };

  return (
    <div style={{ height: '340px', padding: '8px 16px 16px' }}>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default LineChart;
