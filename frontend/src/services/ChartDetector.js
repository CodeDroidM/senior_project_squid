/**
 * Intelligent Chart Detection Service
 * Analyzes query results to automatically suggest optimal visualizations
 */

export class ChartDetector {
  /**
   * Main analysis function - determines best chart types for given data
   * @param {Array} data - Query result rows
   * @param {Array} columns - Column names
   * @param {Object} options - Additional context (sql string, etc.)
   * @returns {Array} Sorted array of chart suggestions
   */
  static analyze(data, columns, options = {}) {
    if (!data || data.length === 0 || !columns || columns.length === 0) {
      return [];
    }

    const columnProfiles = columns.map((col) => this.profileColumn(data, col));

    const analysis = {
      columns: columnProfiles,
      columnStats: columnProfiles.reduce((acc, col) => {
        if (col.stats) {
          acc[col.name] = col.stats;
        }
        return acc;
      }, {}),
      rowCount: data.length,
      queryPattern: this.detectQueryPattern(options.sql || options.query)
    };

    return this.suggestCharts(analysis, data);
  }

  /**
   * Build a profile object for a single column
   */
  static profileColumn(data, column) {
    const type = this.detectColumnType(data, column);
    const cardinality = this.getCardinality(data, column);
    const hasNulls = this.hasNulls(data, column);
    const nullRatio = this.getNullRatio(data, column);
    const uniqueValues = this.getUniqueValues(data, column, 20);
    const nonNullSample = data
      .map(row => row[column])
      .filter(val => val !== null && val !== undefined);
    const sampleSize = Math.min(nonNullSample.length, 500);
    const uniqueRatio = sampleSize > 0
      ? new Set(nonNullSample.slice(0, sampleSize).map(val => typeof val === 'object' ? JSON.stringify(val) : String(val))).size / sampleSize
      : 0;

    const numericValues = this.getNumericValues(data, column, 1000);
    const integerLike = numericValues.length > 0 && numericValues.every(val => Number.isInteger(val));
    const span = numericValues.length > 0 ? Math.max(...numericValues) - Math.min(...numericValues) : 0;

    const stats = type === 'NUMERIC' ? this.getNumericStatsFromValues(numericValues) : null;
    const categoryStats = type === 'CATEGORICAL' ? this.getCategoricalStats(nonNullSample) : null;
    const avgLength = categoryStats?.avgLength ?? this.getLengthStats(nonNullSample).avgLength;
    const codeRatio = this.getCodeLikeRatio(nonNullSample);
    const isTextLike = type === 'CATEGORICAL' && avgLength >= 12 && cardinality <= data.length * 0.5;

    const isId = this.isProbableIdentifier({
      name: column,
      type,
      uniqueRatio,
      cardinality,
      integerLike,
      span,
      codeRatio,
      avgLength
    });

    return {
      name: column,
      type,
      cardinality,
      hasNulls,
      nullRatio,
      uniqueValues,
      isId,
      stats,
      categoryStats,
      uniqueRatio,
      isTextLike,
      codeRatio
    };
  }

  /**
   * Detect column type by analyzing data values
   */
  static detectColumnType(data, column) {
    const sample = data.slice(0, Math.min(200, data.length));
    const nonNullValues = sample
      .map(row => row[column])
      .filter(val => val !== null && val !== undefined && val !== '');

    if (nonNullValues.length === 0) return 'UNKNOWN';

    const numericCount = nonNullValues.filter(val => this.isNumericValue(val)).length;
    const dateCount = nonNullValues.filter(val => this.isDateValue(val)).length;

    const threshold = nonNullValues.length * 0.8;

    if (dateCount >= threshold) return 'DATE';
    if (numericCount >= threshold) return 'NUMERIC';
    
    return 'CATEGORICAL';
  }

  /**
   * Basic column stats helpers used by ChartBuilder + internal profiling.
   * (These are intentionally lightweight so the frontend can still operate
   * when server suggestions are unavailable.)
   */
  static getCardinality(data, column, limit = 5000) {
    if (!Array.isArray(data) || data.length === 0) return 0;
    const sampleSize = Math.min(data.length, limit);
    const values = [];
    for (let i = 0; i < sampleSize; i += 1) {
      const value = data[i]?.[column];
      if (value !== null && value !== undefined) {
        values.push(typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    }
    return new Set(values).size;
  }

  static hasNulls(data, column, limit = 2000) {
    if (!Array.isArray(data) || data.length === 0) return false;
    const sampleSize = Math.min(data.length, limit);
    for (let i = 0; i < sampleSize; i += 1) {
      const value = data[i]?.[column];
      if (value === null || value === undefined) {
        return true;
      }
    }
    return false;
  }

  static getNullRatio(data, column, limit = 5000) {
    if (!Array.isArray(data) || data.length === 0) return 0;
    const sampleSize = Math.min(data.length, limit);
    let nulls = 0;
    for (let i = 0; i < sampleSize; i += 1) {
      const value = data[i]?.[column];
      if (value === null || value === undefined) {
        nulls += 1;
      }
    }
    return nulls / sampleSize;
  }

  static getUniqueValues(data, column, limit = 20) {
    if (!Array.isArray(data) || data.length === 0) return [];
    const seen = new Set();
    const uniques = [];
    for (let i = 0; i < data.length; i += 1) {
      const value = data[i]?.[column];
      if (value === null || value === undefined) continue;
      const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (!seen.has(key)) {
        seen.add(key);
        uniques.push(value);
        if (uniques.length >= limit) break;
      }
    }
    return uniques;
  }

  static isIdentifierName(name) {
    const upper = name.toUpperCase();
    const normalized = upper.replace(/[^A-Z0-9]/g, '');

    if (upper === 'ID' || upper.endsWith('_ID') || upper.startsWith('ID_') || upper.includes(' ID ')) {
      return true;
    }

    if (/ID$/.test(upper) || /_ID$/.test(upper) || /ID_/.test(upper)) {
      return true;
    }

    if (/(REG|FILE|DOC|ACCOUNT|CUSTOMER|CLIENT|STUDENT|EMP|MEMBER|PATIENT)(NUMBER|NO)$/.test(normalized)) {
      return true;
    }

    if (/NO$/.test(normalized) && /(REG|FILE|DOC|ACCOUNT|MEMBER|STUDENT|EMP|PATIENT|SERIAL|BATCH)/.test(normalized)) {
      return true;
    }

    return false;
  }

  static isCodeLikeValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') {
      return Number.isInteger(value) && value.toString().length >= 6;
    }
    const text = String(value).trim();
    if (text.length < 4) return false;
    const normalized = text.replace(/[^A-Z0-9]/gi, '');
    if (normalized.length < 4) return false;
    if (/^\d+$/.test(normalized)) {
      return normalized.length >= 5;
    }
    return /^[A-Z0-9]+$/.test(normalized) && /[A-Z]/.test(normalized) && /\d/.test(normalized);
  }

  /**
   * Determine if a numeric column represents an ID or measurement
   */
  static isIdColumn(data, column, columnInfo = {}) {
    const name = column.toUpperCase();

    if (this.isIdentifierName(name)) {
      return true;
    }

    const sampleSize = Math.min(200, data.length);
    const sample = data.slice(0, sampleSize).map(row => row[column]).filter(val => val !== null && val !== undefined);
    const uniqueRatio = sample.length > 0 ? new Set(sample).size / sample.length : 0;
    const cardinalityRatio = columnInfo.cardinality && data.length ? columnInfo.cardinality / data.length : uniqueRatio;

    if (cardinalityRatio > 0.85 && columnInfo.cardinality > 20) {
      return true;
    }

    if (columnInfo.type === 'CATEGORICAL') {
      const codeLikeCount = sample.filter(val => this.isCodeLikeValue(val)).length;
      if (sample.length > 0 && codeLikeCount / sample.length >= 0.7) {
        return true;
      }
      return false;
    }

    if (columnInfo.type !== 'NUMERIC') {
      return false;
    }

    const values = data
      .slice(0, sampleSize)
      .map(row => this.parseNumericValue(row[column]))
      .filter(val => typeof val === 'number' && Number.isFinite(val));

    if (values.length < 5) {
      return false;
    }

    const allIntegers = values.every(val => Number.isInteger(val));
    if (!allIntegers) {
      return false;
    }

    const numericUniqueRatio = new Set(values).size / values.length;
    return numericUniqueRatio > 0.9;
  }

  /**
   * Determine if a column is a good candidate for visualization
   */
  static isVisualizableColumn(data, column, columnInfo) {
    if (!columnInfo) return false;

    if (columnInfo.isId) {
      return false;
    }

    if (columnInfo.type === 'CATEGORICAL') {
      const ratio = columnInfo.cardinality / Math.max(1, data.length);
      if (ratio > 0.8) {
        return false;
      }
      return columnInfo.cardinality > 1 && columnInfo.cardinality <= 50;
    }

    return true;
  }

  static parseNumericValue(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.trim().replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  static getNumericValues(data, column, limit = 1000) {
    const values = [];
    for (let i = 0; i < data.length && values.length < limit; i += 1) {
      const value = this.parseNumericValue(data[i][column]);
      if (typeof value === 'number' && Number.isFinite(value)) {
        values.push(value);
      }
    }
    return values;
  }

  static getNumericStatsFromValues(values) {
    if (!values || values.length === 0) {
      return null;
    }
    const count = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / count;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count;
    return {
      count,
      mean,
      std: Math.sqrt(variance),
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  static getLengthStats(values) {
    if (!values || values.length === 0) {
      return { avgLength: 0, stdLength: 0 };
    }
    const numericValues = values
      .map(value => (value === null || value === undefined ? null : String(value)))
      .filter(val => val !== null);
    if (numericValues.length === 0) {
      return { avgLength: 0, stdLength: 0 };
    }
    const lengths = numericValues.map(val => val.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + (len - avgLength) ** 2, 0) / lengths.length;
    return { avgLength, stdLength: Math.sqrt(variance) };
  }

  static getCodeLikeRatio(values, sampleSize = 200) {
    if (!values || values.length === 0) {
      return 0;
    }
    const sample = values.slice(0, sampleSize).map(val => (val === null || val === undefined ? '' : String(val).trim()));
    if (sample.length === 0) {
      return 0;
    }
    const matches = sample.filter((text) => {
      if (text.length < 4) return false;
      const normalized = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (normalized.length < 4) return false;
      if (/^\d+$/.test(normalized)) {
        return normalized.length >= 5;
      }
      return /^[A-Z0-9]+$/.test(normalized) && /[A-Z]/.test(normalized) && /\d/.test(normalized);
    });
    return matches.length / sample.length;
  }

  static getCategoricalStats(values, sampleLimit = 2000) {
    if (!values) {
      return {
        counts: [],
        total: 0,
        entropy: 0,
        top1Ratio: 0,
        avgLength: 0,
        stdLength: 0
      };
    }

    const normalizedValues = values
      .filter(val => val !== null && val !== undefined)
      .map(val => (typeof val === 'object' ? JSON.stringify(val) : String(val)))
      .slice(0, sampleLimit);

    const counts = new Map();
    normalizedValues.forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });

    const total = normalizedValues.length;
    if (total === 0) {
      return {
        counts: [],
        total: 0,
        entropy: 0,
        top1Ratio: 0,
        avgLength: 0,
        stdLength: 0
      };
    }

    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top1Count = entries[0]?.[1] ?? 0;
    const entropy = entries.reduce((sum, [, count]) => {
      const p = count / total;
      return sum - p * Math.log2(p);
    }, 0);

    const lengths = normalizedValues.map(val => val.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / total;
    const variance = lengths.reduce((sum, len) => sum + (len - avgLength) ** 2, 0) / total;

    return {
      counts: entries,
      total,
      entropy,
      top1Ratio: top1Count / total,
      avgLength,
      stdLength: Math.sqrt(variance)
    };
  }

  static isProbableIdentifier({ name, type, uniqueRatio, cardinality, integerLike, span, codeRatio, avgLength }) {
    let evidence = 0;

    if (uniqueRatio >= 0.98 && cardinality >= 20) {
      if ((type === 'NUMERIC' && integerLike) || codeRatio >= 0.5 || (avgLength > 0 && avgLength <= 10)) {
        evidence += 1;
      }
    }

    if (type === 'NUMERIC' && integerLike && uniqueRatio >= 0.98 && span > Math.max(100, cardinality * 0.5)) {
      evidence += 0.5;
    }

    if (codeRatio >= 0.7 && uniqueRatio >= 0.9) {
      evidence += 1;
    }

    if (uniqueRatio >= 0.995 && cardinality >= 50) {
      evidence += 1;
    }

    if (evidence === 0 && this.isIdentifierName(name) && uniqueRatio >= 0.9 && cardinality >= 15) {
      evidence += 0.5;
    }

    return evidence >= 1;
  }

  /**
   * Check if value is numeric
   */
  static isNumericValue(value) {
    return this.parseNumericValue(value) !== null;
  }

  /**
   * Check if value is a date
   */
  static isDateValue(value) {
    if (value instanceof Date) return true;
    if (typeof value === 'string') {
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
        /^\d{4}\/\d{2}\/\d{2}$/,
        /^\d{2}-\d{2}-\d{4}$/,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      ];
      return datePatterns.some(pattern => pattern.test(value));
    }
    return false;
  }

  /**
   * Get number of unique values in column
   */
  

  static getNumericStats(data, column) {
    const values = data
      .map(row => this.parseNumericValue(row[column]))
      .filter(val => typeof val === 'number' && Number.isFinite(val));

    if (values.length === 0) {
      return null;
    }

    const count = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / count;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count;
    const std = Math.sqrt(variance);

    return {
      count,
      mean,
      std,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  static computeCorrelation(data, colX, colY, limit = 500) {
    const pairs = [];
    for (const row of data) {
      const x = this.parseNumericValue(row[colX]);
      const y = this.parseNumericValue(row[colY]);
      if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
        pairs.push([x, y]);
        if (pairs.length >= limit) break;
      }
    }

    if (pairs.length < 5) {
      return 0;
    }

    const xs = pairs.map(p => p[0]);
    const ys = pairs.map(p => p[1]);
    const meanX = xs.reduce((sum, v) => sum + v, 0) / pairs.length;
    const meanY = ys.reduce((sum, v) => sum + v, 0) / pairs.length;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    for (let i = 0; i < pairs.length; i += 1) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    if (denomX === 0 || denomY === 0) {
      return 0;
    }

    return Math.abs(numerator / Math.sqrt(denomX * denomY));
  }

  /**
   * Generate chart suggestions based on column analysis
   */
  static suggestCharts(analysis, data) {
    const suggestions = [];

    const visualizableColumns = analysis.columns.filter(col => this.isVisualizableColumn(data, col.name, col));
    const numeric = visualizableColumns.filter(c => c.type === 'NUMERIC');
    const categorical = analysis.columns.filter((c) => {
      if (c.isId) {
        return false;
      }

      const isCategoryType = c.type === 'CATEGORICAL' || (c.isTextLike && c.cardinality <= 25);
      if (!isCategoryType) {
        return false;
      }

      if (c.cardinality < 2 || c.cardinality > 80) {
        return false;
      }

      const ratio = c.cardinality / Math.max(1, analysis.rowCount);
      const top1Ratio = c.categoryStats?.top1Ratio ?? c.categoryStats?.top1_ratio ?? 0;
      if (ratio > 0.95 && top1Ratio >= 0.95) {
        return false;
      }

      return true;
    });
    const dates = analysis.columns.filter(c => c.type === 'DATE');

    const queryPattern = analysis.queryPattern || {};
    const isAggregatedQuery = Boolean(queryPattern.hasGroupBy && (queryPattern.hasSum || queryPattern.hasCount || queryPattern.hasAvg));

    // Pattern 0: Univariate distributions
    numeric.slice(0, 3).forEach((col) => {
      suggestions.push({
        type: 'bar',
        priority: 2,
        score: col.stats?.std || 0,
        transform: { type: 'histogram', column: col.name },
        icon: '📊',
        reason: 'Numeric distribution detected',
        description: `Distribution of ${col.name}`
      });
    });

    const categoricalCounts = categorical
      .filter(col => col.cardinality <= 20)
      .slice(0, 3);

    categoricalCounts.forEach((col) => {
      const entropy = col.categoryStats?.entropy ?? 0;
      const nullPenalty = col.nullRatio > 0.3 ? 0.6 : 1;
      const cardinalityPenalty = col.cardinality > 15 ? 0.75 : 1;
      const top = Math.min(col.cardinality, 20);
      suggestions.push({
        type: 'bar',
        priority: 2,
        score: (entropy || col.cardinality) * nullPenalty * cardinalityPenalty,
        transform: {
          type: 'categoricalCounts',
          column: col.name,
          top,
          includeOther: top < col.cardinality
        },
        icon: '📊',
        reason: 'Categorical distribution',
        description: `Record count by ${col.name}`
      });
    });

    // Pattern 1: Time Series (Date + Numeric)
    if (dates.length >= 1 && numeric.length >= 1) {
      const metricsToShow = numeric.slice(0, 3);
      const dateCol = dates[0];
      const needsAgg = dateCol.cardinality < analysis.rowCount * 0.8;
      const suggestion = {
        type: 'line',
        priority: isAggregatedQuery ? 1 : 2,
        score: metricsToShow.reduce((acc, col) => acc + (col.stats?.std || 0), 0),
        x: dateCol.name,
        y: needsAgg ? metricsToShow.map(n => `Avg ${n.name}`) : metricsToShow.map(n => n.name),
        reason: isAggregatedQuery ? 'Aggregated time series detected' : 'Time-based data detected',
        icon: '📈',
        description: `Trend of ${metricsToShow.map(n => n.name).join(', ')} over ${dateCol.name}`
      };
      if (needsAgg) {
        suggestion.transform = {
          type: 'aggregate',
          groupBy: dateCol.name,
          metrics: metricsToShow.map(n => ({
            column: n.name,
            method: 'avg',
            label: `Avg ${n.name}`
          })),
          limit: Math.min(dateCol.cardinality, 50),
          sort: 'asc'
        };
      }
      suggestions.push(suggestion);
    }

    // Pattern 2: Category + Metric (Bar / Pie)
    if (categorical.length >= 1 && numeric.length >= 1) {
      const lowCardinality = categorical.filter(c => c.cardinality <= 20);
      if (lowCardinality.length > 0) {
        const cat = lowCardinality[0];
        const metric = numeric[0];
        const spreadScore = metric.stats?.std || 0;
        const entropy = cat.categoryStats?.entropy ?? 0;
        const top1Ratio = cat.categoryStats?.top1Ratio ?? 1;
        const nullPenalty = cat.nullRatio > 0.3 ? 0.6 : 1;
        const readabilityPenalty = cat.cardinality > 15 ? 0.75 : 1;
        const aggregateScore = (spreadScore + entropy) * nullPenalty * readabilityPenalty;

        if (cat.cardinality >= 2 && cat.cardinality <= 6 && top1Ratio < 0.85) {
          suggestions.push({
            type: 'pie',
            priority: 1,
            score: (entropy || spreadScore) * nullPenalty,
            labels: 'category',
            values: 'count',
            reason: `${cat.cardinality} categories - balanced distribution`,
            icon: '🥧',
            description: `Record distribution by ${cat.name}`,
            transform: {
              type: 'categoricalCounts',
              column: cat.name,
              top: cat.cardinality,
              includeOther: false
            }
          });
        }

        // Pre-aggregated: show data directly
        if (isAggregatedQuery) {
          suggestions.push({
            type: 'bar',
            priority: cat.cardinality <= 10 ? 1 : 2,
            score: aggregateScore,
            x: cat.name,
            y: [metric.name],
            reason: `Compare ${metric.name} across ${cat.cardinality} categories`,
            icon: '📊',
            description: `${metric.name} by ${cat.name}`,
          });
        } else {
          suggestions.push({
            type: 'bar',
            priority: cat.cardinality <= 10 ? 1 : 2,
            score: aggregateScore,
            x: cat.name,
            y: [`Avg ${metric.name}`],
            reason: `Compare ${metric.name} across ${cat.cardinality} categories`,
            icon: '📊',
            description: `Average ${metric.name} by ${cat.name}`,
            transform: {
              type: 'aggregate',
              method: 'avg',
              groupBy: cat.name,
              column: metric.name,
              label: `Avg ${metric.name}`,
              limit: Math.min(cat.cardinality, 15),
              sort: 'desc'
            }
          });
        }
      }
    }

    // Pattern 3: Multiple categories (stacked/grouped)
    if (categorical.length >= 2 && numeric.length >= 1) {
      const cat1 = categorical[0];
      const cat2 = categorical[1];
      const metric = numeric[0];
      if (cat1.cardinality <= 10 && cat2.cardinality <= 6) {
        suggestions.push({
          type: 'stackedBar',
          priority: 2,
          score: (metric.stats?.std || 0) * 0.5,
          x: cat1.name,
          y: [metric.name],
          stack: cat2.name,
          reason: `Breakdown of ${metric.name} by ${cat1.name} and ${cat2.name}`,
          icon: '📊',
          description: `${metric.name} breakdown by ${cat1.name} and ${cat2.name}`,
          transform: {
            type: 'aggregateStacked',
            groupBy: cat1.name,
            stackBy: cat2.name,
            column: metric.name,
            method: 'avg',
            groupLimit: Math.min(cat1.cardinality, 10),
            stackLimit: Math.min(cat2.cardinality, 6),
            sort: 'desc'
          }
        });
      }
    }

    // Pattern 3b: Multi-metric comparisons on one category
    if (categorical.length >= 1 && numeric.length >= 2) {
      const cat = categorical[0];
      const metricsToCompare = numeric.slice(0, Math.min(3, numeric.length));
      const metricLabels = metricsToCompare.map(metric => `Avg ${metric.name}`);
      const aggregateMetrics = metricsToCompare.map(metric => ({
        column: metric.name,
        method: 'avg',
        label: `Avg ${metric.name}`
      }));
      const comparisonScore = metricsToCompare.reduce((acc, metric) => acc + (metric.stats?.std || 0), 0) * (cat.nullRatio > 0.3 ? 0.6 : 1);

      suggestions.push({
        type: 'bar',
        priority: cat.cardinality <= 12 ? 1 : 2,
        score: comparisonScore,
        x: cat.name,
        y: metricLabels,
        reason: `Compare ${metricsToCompare.map(m => m.name).join(', ')} by ${cat.name}`,
        icon: '📊',
        description: `${metricsToCompare.map(m => m.name).join(' vs ')} by ${cat.name}`,
        transform: {
          type: 'aggregate',
          groupBy: cat.name,
          metrics: aggregateMetrics,
          limit: Math.min(cat.cardinality, 12),
          sort: 'desc'
        }
      });

      if (cat.cardinality <= 12) {
        suggestions.push({
          type: 'line',
          priority: 2,
          score: comparisonScore * 0.8,
          x: cat.name,
          y: metricLabels,
          reason: `Trend comparison across ${cat.name}`,
          icon: '📈',
          description: `Trend of ${metricsToCompare.map(m => m.name).join(' & ')} by ${cat.name}`,
          transform: {
            type: 'aggregate',
            groupBy: cat.name,
            metrics: aggregateMetrics,
            limit: Math.min(cat.cardinality, 12),
            sort: 'asc'
          }
        });
      }
    }

    // Pattern 4: Numeric correlations (scatter)
    if (numeric.length >= 2) {
      const corrScore = this.computeCorrelation(data, numeric[0].name, numeric[1].name);
      suggestions.push({
        type: 'scatter',
        priority: 3,
        score: corrScore,
        x: numeric[0].name,
        y: numeric[1].name,
        reason: corrScore > 0.5 ? 'Strong correlation detected' : 'Explore relationship between metrics',
        icon: '🔵',
        description: `${numeric[1].name} vs ${numeric[0].name}`
      });
    }

    const uniqueSuggestions = suggestions
      .sort((a, b) => {
        const priorityDiff = (a.priority ?? 99) - (b.priority ?? 99);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return (b.score ?? 0) - (a.score ?? 0);
      })
      .filter((suggestion, index, self) =>
        index === self.findIndex((s) =>
          s.type === suggestion.type &&
          s.x === suggestion.x &&
          JSON.stringify(s.y || []) === JSON.stringify(suggestion.y || []) &&
          (s.transform?.column || '') === (suggestion.transform?.column || '')
        )
      );

    return uniqueSuggestions.slice(0, 8);
  }

  /**
   * Parse SQL query to detect aggregation patterns
   * This can enhance chart suggestions
   */
  static detectQueryPattern(sql) {
    if (!sql) return {};

    const upperSql = sql.toUpperCase();
    
    return {
      hasGroupBy: upperSql.includes('GROUP BY'),
      hasSum: upperSql.includes('SUM('),
      hasCount: upperSql.includes('COUNT('),
      hasAvg: upperSql.includes('AVG('),
      hasMax: upperSql.includes('MAX('),
      hasMin: upperSql.includes('MIN('),
      hasOrderBy: upperSql.includes('ORDER BY'),
      hasLimit: upperSql.includes('LIMIT') || upperSql.includes('FETCH FIRST')
    };
  }
}

export default ChartDetector;
