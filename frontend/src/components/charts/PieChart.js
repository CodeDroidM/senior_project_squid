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
  // Support multiple config shapes: some paths set `labels`/`values`, others set `x` and `y`
  const labelColumn = config.labels ?? config.x ?? null;
  // `y` may be an array (['count']) or a single column name
  const valueColumn = config.values ?? (Array.isArray(config.y) ? config.y[0] : config.y) ?? null;

  // Fallback keys from categoricalCounts transform
  const fallbackLabelKey = 'category';
  const fallbackValueKey = 'count';

  const chartLabels = data.map(row => {
    let v = null;
    if (labelColumn) v = row[labelColumn];
    if (v === null || v === undefined) v = row[fallbackLabelKey] ?? null;
    return v === null || v === undefined ? 'undefined' : String(v);
  });

  const chartValues = data.map(row => {
    let raw = null;
    if (valueColumn) raw = row[valueColumn];
    if (raw === null || raw === undefined) raw = row[fallbackValueKey] ?? null;
    if (raw === null || raw === undefined) return 0;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
      const parsed = parseFloat(raw.replace(/,/g, ''));
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  });

  // DEBUG: log config + sample rows so we can diagnose 'undefined' legend labels
  try {
    // Use console.debug so it's easy to filter in browser devtools
    console.debug('PieChart debug — config:', config);
    console.debug('PieChart debug — resolved labelColumn:', labelColumn, 'valueColumn:', valueColumn);
    console.debug('PieChart debug — sample rows:', data.slice(0, 5));
    console.debug('PieChart debug — chartLabels sample:', chartLabels.slice(0, 8));
    console.debug('PieChart debug — chartValues sample:', chartValues.slice(0, 8));
  } catch (e) {
    // ignore logging errors
  }

  // If all labels are 'undefined' or all values are zero, show a friendly message
  const allLabelsUndefined = chartLabels.length > 0 && chartLabels.every(l => l === 'undefined');
  const allValuesZero = chartValues.length > 0 && chartValues.every(v => v === 0);
  if (allLabelsUndefined || allValuesZero) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ color: '#9a9a9a', textAlign: 'center' }}>
          No valid data available for this pie chart (labels or values missing).
        </div>
      </div>
    );
  }

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
