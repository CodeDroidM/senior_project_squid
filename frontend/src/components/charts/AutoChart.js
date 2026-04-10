import React, { useMemo } from 'react';
import BarChart from './BarChart';
import PieChart from './PieChart';
import LineChart from './LineChart';
import ScatterPlot from './ScatterPlot';
import { Box, Typography } from '@mui/material';

const formatNumber = (value) => {
  if (value === null || value === undefined) return '';
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
};

const parseNumericValue = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const aggregateData = (data, transform) => {
  const {
    groupBy,
    column,
    columns,
    metrics,
    method = 'avg',
    limit = 15,
    sort = 'desc',
    label,
    labels
  } = transform;

  if (!groupBy) {
    return { rows: data, meta: { x: groupBy, y: column ? [column] : [] } };
  }

  const normalizeMetric = (metric, idx) => {
    if (typeof metric === 'string') {
      return { column: metric };
    }
    if (!metric) {
      return { column: column ?? metric?.column ?? null };
    }
    return metric;
  };

  const metricSources = metrics && metrics.length > 0
    ? metrics
    : (columns && columns.length > 0
      ? columns
      : [{ column }]);

  const metricDefs = metricSources.map((metric, index) => {
    const normalized = normalizeMetric(metric, index);
    const metricMethod = normalized.method || (Array.isArray(method) ? method[index] ?? method[0] : method);
    const metricLabel = normalized.label
      || (Array.isArray(labels) ? labels[index] : labels)
      || (metricMethod === 'count'
        ? (normalized.column ? `COUNT(${normalized.column})` : 'count')
        : `${metricMethod?.toUpperCase() || 'AVG'}(${normalized.column || ''})`);

    return {
      column: normalized.column,
      method: metricMethod || 'avg',
      label: metricLabel
    };
  });

  const aggregates = new Map();
  data.forEach((row) => {
    const key = row[groupBy] ?? 'Unknown';
    if (!aggregates.has(key)) {
      aggregates.set(key, metricDefs.map(() => ({ sum: 0, count: 0 })));
    }
    const entry = aggregates.get(key);

    metricDefs.forEach((metric, idx) => {
      if (metric.method === 'count') {
        entry[idx].sum += 1;
        return;
      }

      const numericValue = parseNumericValue(row[metric.column]);
      if (numericValue === null) {
        return;
      }

      if (metric.method === 'sum') {
        entry[idx].sum += numericValue;
      } else {
        entry[idx].sum += numericValue;
        entry[idx].count += 1;
      }
    });
  });

  let rows = Array.from(aggregates.entries()).map(([group, statsArray]) => {
    const resultRow = { [groupBy]: group };
    statsArray.forEach((stats, idx) => {
      const metric = metricDefs[idx];
      let value;
      if (metric.method === 'count') {
        value = stats.sum;
      } else if (metric.method === 'sum') {
        value = stats.sum;
      } else {
        value = stats.count === 0 ? 0 : stats.sum / stats.count;
      }
      resultRow[metric.label] = value;
    });
    return resultRow;
  });

  const primaryMetric = metricDefs[0]?.label;
  if (primaryMetric) {
    if (sort === 'asc') {
      const allMonths = rows.every(r => getMonthIndex(r[groupBy]) !== null);
      if (allMonths) {
        rows.sort((a, b) => getMonthIndex(a[groupBy]) - getMonthIndex(b[groupBy]));
      } else {
        const aDate = Date.parse(rows[0]?.[groupBy]);
        const bDate = Date.parse(rows[1]?.[groupBy]);
        if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
          rows.sort((a, b) => Date.parse(a[groupBy]) - Date.parse(b[groupBy]));
        } else {
          rows.sort((a, b) => {
            const aVal = a[groupBy]; const bVal = b[groupBy];
            if (!isNaN(Number(aVal)) && !isNaN(Number(bVal))) return Number(aVal) - Number(bVal);
            return String(aVal).localeCompare(String(bVal));
          });
        }
      }
    } else {
      rows.sort((a, b) => {
        const aVal = a[primaryMetric] ?? 0;
        const bVal = b[primaryMetric] ?? 0;
        return bVal - aVal;
      });
    }
  }

  if (limit && limit > 0) {
    rows = rows.slice(0, limit);
  }

  return {
    rows,
    meta: {
      x: groupBy,
      y: metricDefs.map(metric => metric.label)
    }
  };
};

const buildStackedAggregate = (data, transform) => {
  const {
    groupBy,
    stackBy,
    column,
    method = 'avg',
    groupLimit = 10,
    stackLimit = 6,
    sort = 'desc'
  } = transform;

  if (!groupBy || !stackBy || (!column && method !== 'count')) {
    return {
      rows: data,
      meta: { x: groupBy, y: column ? [column] : [] }
    };
  }

  const aggregates = new Map();

  data.forEach((row) => {
    const groupKey = row[groupBy] ?? 'Unknown';
    const stackKey = row[stackBy] ?? 'Other';

    if (!aggregates.has(groupKey)) {
      aggregates.set(groupKey, new Map());
    }

    const groupMap = aggregates.get(groupKey);
    if (!groupMap.has(stackKey)) {
      groupMap.set(stackKey, { sum: 0, count: 0 });
    }

    const stats = groupMap.get(stackKey);

    if (method === 'count') {
      stats.count += 1;
    } else {
      const numericValue = parseNumericValue(row[column]);
      if (numericValue !== null) {
        stats.sum += numericValue;
        stats.count += 1;
      }
    }
  });

  const groupEntries = Array.from(aggregates.entries()).map(([groupKey, stackMap]) => {
    const stackValues = {};
    let total = 0;

    stackMap.forEach((stats, stackKey) => {
      let value;
      if (method === 'count') {
        value = stats.count;
      } else if (method === 'sum') {
        value = stats.sum;
      } else {
        value = stats.count === 0 ? 0 : stats.sum / stats.count;
      }
      stackValues[stackKey] = value;
      total += value;
    });

    return { groupKey, stackValues, total };
  });

  const sortedGroups = [...groupEntries].sort((a, b) =>
    sort === 'asc' ? a.total - b.total : b.total - a.total
  );
  const limitedGroups = groupLimit > 0 ? sortedGroups.slice(0, groupLimit) : sortedGroups;

  const stackTotals = new Map();
  limitedGroups.forEach(({ stackValues }) => {
    Object.entries(stackValues).forEach(([stackLabel, value]) => {
      stackTotals.set(stackLabel, (stackTotals.get(stackLabel) || 0) + value);
    });
  });

  const orderedStacks = [...stackTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([stackLabel]) => stackLabel);
  const limitedStacks = stackLimit > 0 ? orderedStacks.slice(0, stackLimit) : orderedStacks;

  const rows = limitedGroups.map(({ groupKey, stackValues }) => {
    const row = { [groupBy]: groupKey };
    limitedStacks.forEach((stackLabel) => {
      row[stackLabel] = stackValues[stackLabel] ?? 0;
    });
    return row;
  });

  return {
    rows,
    meta: {
      x: groupBy,
      y: limitedStacks,
      stackCategories: limitedStacks
    }
  };
};

const buildHistogram = (data, column, bins = 10) => {
  const values = data
    .map(row => {
      const raw = row[column];
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') {
        const parsed = parseFloat(raw.replace(/,/g, ''));
        return Number.isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter(val => typeof val === 'number' && Number.isFinite(val));

  if (values.length === 0) {
    return { rows: [], meta: { x: column, y: ['count'] } };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const bucketCount = Math.min(Math.max(bins, 5), 30);
  const binSize = (max - min) / bucketCount || 1;
  const buckets = new Array(bucketCount).fill(0);

  values.forEach((value) => {
    let idx = Math.floor((value - min) / binSize);
    if (idx >= bucketCount) idx = bucketCount - 1;
    buckets[idx] += 1;
  });

  const rows = buckets.map((count, idx) => {
    const start = min + idx * binSize;
    const end = start + binSize;
    return {
      binLabel: `${formatNumber(start)} – ${formatNumber(end)}`,
      count
    };
  });

  return {
    rows,
    meta: {
      x: 'binLabel',
      y: ['count']
    }
  };
};

const buildCategoricalCounts = (data, column, top = 20, includeOther = true) => {
  const counts = new Map();
  data.forEach((row) => {
    const key = row[column] ?? 'NULL';
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const sortedEntries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = sortedEntries.reduce((sum, [, count]) => sum + count, 0);
  const limitedEntries = typeof top === 'number' && top > 0
    ? sortedEntries.slice(0, top)
    : sortedEntries;

  const rows = limitedEntries.map(([label, count]) => ({ category: String(label), count }));

  if (includeOther && limitedEntries.length < sortedEntries.length) {
    const otherCount = sortedEntries.slice(limitedEntries.length).reduce((sum, [, count]) => sum + count, 0);
    if (otherCount > 0) {
      rows.push({ category: 'Other', count: otherCount });
    }
  }

  return {
    rows,
    meta: {
      x: 'category',
      y: ['count']
    },
    total
  };
};

const MONTH_ORDER = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const getMonthIndex = (value) => {
  if (value === null || value === undefined) return null;
  const key = String(value).trim().toLowerCase();
  return MONTH_ORDER[key] ?? null;
};

const maybeSortByDate = (rows, field) => {
  if (!Array.isArray(rows) || rows.length === 0 || !field) {
    return rows;
  }

  // Try month-name ordering
  const monthDecorated = rows.map((row, index) => ({
    row,
    monthIdx: getMonthIndex(row[field]),
    index
  }));
  const monthValid = monthDecorated.filter(e => e.monthIdx !== null).length;
  if (monthValid >= rows.length * 0.5) {
    const sorted = [...monthDecorated].sort((a, b) => {
      if (a.monthIdx === null && b.monthIdx === null) return a.index - b.index;
      if (a.monthIdx === null) return 1;
      if (b.monthIdx === null) return -1;
      return a.monthIdx - b.monthIdx;
    });
    return sorted.map(e => e.row);
  }

  // Fall back to Date.parse ordering
  const decorated = rows.map((row, index) => {
    const value = row[field];
    const timestamp = value !== null && value !== undefined ? Date.parse(value) : NaN;
    return {
      row,
      timestamp: Number.isNaN(timestamp) ? null : timestamp,
      index
    };
  });

  const validCount = decorated.filter(entry => entry.timestamp !== null).length;
  if (validCount < 2) {
    return rows;
  }

  const sorted = [...decorated].sort((a, b) => {
    if (a.timestamp === null && b.timestamp === null) {
      return a.index - b.index;
    }
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return a.timestamp - b.timestamp;
  });

  return sorted.map(entry => entry.row);
};

const applyTransform = (data, config) => {
  if (!config?.transform) {
    return { rows: data, finalConfig: config };
  }

  const { type, column, bins, top, includeOther = true } = config.transform;

  if (type === 'histogram') {
    const histogram = buildHistogram(data, column, bins);
    return {
      rows: histogram.rows,
      finalConfig: {
        ...config,
        x: histogram.meta.x,
        y: histogram.meta.y,
        transformApplied: true
      }
    };
  }

  if (type === 'categoricalCounts') {
    const cat = buildCategoricalCounts(data, column, top, includeOther);
    return {
      rows: cat.rows,
      finalConfig: {
        ...config,
        x: cat.meta.x,
        y: cat.meta.y,
        transformApplied: true
      }
    };
  }

  if (type === 'aggregate') {
    const aggregated = aggregateData(data, config.transform);
    return {
      rows: aggregated.rows,
      finalConfig: {
        ...config,
        x: aggregated.meta.x,
        y: aggregated.meta.y,
        transformApplied: true
      }
    };
  }

  if (type === 'aggregateStacked') {
    const stacked = buildStackedAggregate(data, config.transform);
    return {
      rows: stacked.rows,
      finalConfig: {
        ...config,
        x: stacked.meta.x,
        y: stacked.meta.y,
        stacked: true,
        stackCategories: stacked.meta.stackCategories,
        transformApplied: true
      }
    };
  }

  return { rows: data, finalConfig: config };
};

const AutoChart = ({ data, config }) => {
  const { rows, finalConfig, hasData } = useMemo(() => {
    const hasValidData = Array.isArray(data) && data.length > 0;

    if (!config || !hasValidData) {
      return {
        rows: hasValidData ? data : [],
        finalConfig: config,
        hasData: hasValidData
      };
    }

    const transformed = applyTransform(data, config);
    return {
      ...transformed,
      hasData: hasValidData
    };
  }, [data, config]);

  if (!hasData || !finalConfig) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No data available for visualization
        </Typography>
      </Box>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          Not enough data to plot this visualization
        </Typography>
      </Box>
    );
  }

  try {
    const chartRows = finalConfig.type === 'line'
      ? maybeSortByDate(rows, finalConfig.x)
      : rows;

    switch (finalConfig.type) {
      case 'line':
        return <LineChart data={chartRows} config={finalConfig} />;
      
      case 'bar':
      case 'horizontalBar':
      case 'stackedBar':
        return <BarChart data={chartRows} config={finalConfig} />;
      
      case 'pie':
        return <PieChart data={chartRows} config={finalConfig} />;
      
      case 'scatter':
        return <ScatterPlot data={chartRows} config={finalConfig} />;
      
      default:
        return (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Chart type "{finalConfig.type}" not yet implemented
            </Typography>
          </Box>
        );
    }
  } catch (error) {
    console.error('Error rendering chart:', error);
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">
          Error rendering chart: {error.message}
        </Typography>
      </Box>
    );
  }
};

export default AutoChart;
