import React from 'react';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title
} from 'chart.js';

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title
);

const ScatterPlot = ({ data, config }) => {
  const { x, y } = config;
  
  const scatterData = data.map(row => {
    const xValue = row[x];
    const yValue = row[y];
    return {
      x: typeof xValue === 'string' ? parseFloat(xValue.replace(/,/g, '')) : xValue,
      y: typeof yValue === 'string' ? parseFloat(yValue.replace(/,/g, '')) : yValue
    };
  });

  const chartData = {
    datasets: [
      {
        label: `${y} vs ${x}`,
        data: scatterData,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: config.description || `${y} vs ${x}`,
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${x}: ${context.parsed.x}, ${y}: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: x
        },
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
          }
        }
      },
      y: {
        title: {
          display: true,
          text: y
        },
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
          }
        }
      }
    }
  };

  return (
    <div style={{ height: '400px', padding: '20px' }}>
      <Scatter data={chartData} options={options} />
    </div>
  );
};

export default ScatterPlot;
