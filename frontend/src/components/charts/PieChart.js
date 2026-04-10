import React from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  Title
);

const PieChart = ({ data, config }) => {
  const { labels: labelColumn, values: valueColumn } = config;
  
  const chartLabels = data.map(row => row[labelColumn]);
  const chartValues = data.map(row => {
    const value = row[valueColumn];
    return typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value;
  });

  const COLORS = [
    '#9c6fde', '#64b5f6', '#89d185', '#f48771',
    '#80cbc4', '#ce93d8', '#f4a261', '#4fc3f7',
  ];

  const chartData = {
    labels: chartLabels,
    datasets: [{
      label: valueColumn,
      data: chartValues,
      backgroundColor: COLORS.map(c => c + 'cc'),
      borderColor: COLORS,
      borderWidth: 1,
      hoverOffset: 6,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#d4d4d4',
          font: { size: 12, family: '"Segoe UI",sans-serif' },
          boxWidth: 12,
          padding: 14,
        },
      },
      title: {
        display: true,
        text: config.description || `${valueColumn} Distribution`,
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
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            return `${ctx.label}: ${new Intl.NumberFormat('en-US').format(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height: '340px', padding: '8px 16px 16px' }}>
      <Pie data={chartData} options={options} />
    </div>
  );
};

export default PieChart;
