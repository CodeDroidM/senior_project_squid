"""Server-side chart suggestion engine.

This module is intended to be the *source of truth* for chart suggestions.
Frontend can use its own heuristics as a fallback only.

Design goals
- Data-driven: base decisions on distributions, cardinality, entropy, dominance, etc.
- Schema-aware (optional): accept metadata hints (PK/FK, declared types) as priors.
- Cheap: operate on limited samples.

Public API
- suggest_charts(df, schema_hints=None) -> list[dict]

Schema hints (optional)
- schema_hints is a dict keyed by column name.
- Each value can include:
  - declared_type: str | None (e.g., NUMBER, VARCHAR2, DATE)
  - is_primary_key: bool
  - is_foreign_key: bool
  - is_nullable: bool

"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping
import math
import re

import numpy as np

try:
    import pandas as pd
except ImportError:  # pragma: no cover
    pd = None


DATE_FORMAT_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^\d{4}-\d{2}-\d{2}$"), "%Y-%m-%d"),
    (re.compile(r"^\d{2}/\d{2}/\d{4}$"), "%m/%d/%Y"),
    (re.compile(r"^\d{4}/\d{2}/\d{2}$"), "%Y/%m/%d"),
    (re.compile(r"^\d{2}-\d{2}-\d{4}$"), "%m-%d-%Y"),
    (re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$"), "%Y-%m-%dT%H:%M:%S"),
]


def infer_date_format(series, sample_size: int = 50) -> str | None:
    if series is None:
        return None
    non_null = series.dropna()
    if non_null.empty:
        return None

    sample = non_null.astype(str).head(sample_size)
    total = len(sample)
    if total == 0:
        return None

    match_counts: dict[str, int] = {}
    for value in sample:
        text = value.strip()
        for pattern, fmt in DATE_FORMAT_PATTERNS:
            if pattern.match(text):
                match_counts[fmt] = match_counts.get(fmt, 0) + 1
                break

    if not match_counts:
        return None

    best_format, best_count = max(match_counts.items(), key=lambda item: item[1])
    if (best_count / total) >= 0.7:
        return best_format
    return None


def _code_like_ratio(series, sample_size: int = 200) -> float:
    if series is None:
        return 0.0
    non_null = series.dropna()
    if non_null.empty:
        return 0.0
    sample = non_null.astype(str).head(sample_size)
    if sample.empty:
        return 0.0

    def is_code(value: str) -> bool:
        trimmed = value.strip()
        if len(trimmed) < 4:
            return False
        normalized = re.sub(r"[^A-Z0-9]", "", trimmed.upper())
        if len(normalized) < 4:
            return False
        if normalized.isdigit():
            return len(normalized) >= 5
        return normalized.isalnum() and any(ch.isalpha() for ch in normalized) and any(ch.isdigit() for ch in normalized)

    matches = sample.apply(is_code).sum()
    return float(matches) / float(len(sample))


def _length_stats(series) -> tuple[float, float]:
    if series is None:
        return 0.0, 0.0
    non_null = series.dropna()
    if non_null.empty:
        return 0.0, 0.0
    lengths = non_null.astype(str).str.len()
    if lengths.empty:
        return 0.0, 0.0
    return float(lengths.mean()), float(lengths.std(ddof=0) or 0.0)


def _entropy_from_counts(counts: np.ndarray) -> float:
    total = float(counts.sum() or 0.0)
    if total <= 0:
        return 0.0
    ps = counts / total
    ps = ps[ps > 0]
    return float(-(ps * np.log2(ps)).sum())


@dataclass
class ColumnProfile:
    name: str
    semantic_type: str  # NUMERIC | DATE | CATEGORICAL
    semantic_role: str  # METRIC | TEMPORAL | CATEGORY | TEXT | IDENTIFIER
    cardinality: int
    null_ratio: float
    unique_ratio: float
    stats: dict[str, Any]


def _assess_identifier(
    *,
    col: str,
    semantic_type: str,
    unique_ratio: float,
    cardinality: int,
    numeric_series,
    code_ratio: float,
    avg_len: float,
    schema_hint: Mapping[str, Any] | None,
) -> bool:
    # Strong priors from schema.
    if schema_hint:
        if schema_hint.get("is_primary_key"):
            return True
        # FK columns are often identifiers too.
        if schema_hint.get("is_foreign_key") and unique_ratio > 0.6:
            return True

    evidence = 0.0

    integer_like = False
    span = 0.0
    if semantic_type == "NUMERIC" and numeric_series is not None:
        numeric_values = numeric_series.dropna()
        if not numeric_values.empty:
            integer_like = numeric_values.apply(lambda v: float(v).is_integer()).all()
            span = float(numeric_values.max() - numeric_values.min())

    # Pure data-driven evidence.
    if unique_ratio >= 0.98 and cardinality >= 20:
        if (semantic_type == "NUMERIC" and integer_like) or code_ratio >= 0.5 or (0 < avg_len <= 10):
            evidence += 1.0

    if integer_like and unique_ratio >= 0.98 and span > max(100.0, cardinality * 0.5):
        evidence += 0.5

    if code_ratio >= 0.7 and unique_ratio >= 0.9:
        evidence += 1.0

    if unique_ratio >= 0.995 and cardinality >= 50:
        evidence += 1.0

    return evidence >= 1.0


def profile_dataframe(df, schema_hints: Mapping[str, Mapping[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Profile columns with distribution + role inference.

    Returns a list of dicts (JSON-friendly) to keep compatibility with existing code.
    """
    profiles: list[dict[str, Any]] = []

    for column in df.columns:
        hint = (schema_hints or {}).get(str(column))
        series = df[column]
        non_null = series.dropna()
        cardinality = int(non_null.nunique())
        non_null_count = len(non_null)
        row_count = len(series)
        null_ratio = float(1 - (non_null_count / row_count if row_count else 0))
        unique_ratio = float(cardinality) / float(non_null_count or 1)

        numeric_series = pd.to_numeric(series, errors="coerce")
        numeric_ratio = float(numeric_series.notna().mean()) if row_count else 0.0

        detected_format = None
        date_ratio = 0.0
        semantic_type = "CATEGORICAL"
        semantic_role = "CATEGORY"

        stats: dict[str, Any] = {
            "row_count": row_count,
            "cardinality": cardinality,
            "unique_ratio": unique_ratio,
            "null_ratio": null_ratio,
            "sample_values": [str(val) for val in non_null.head(5).tolist()],
        }

        declared_type = (hint or {}).get("declared_type")
        declared_upper = str(declared_type).upper() if declared_type is not None else ""

        # Declared type priors (soft): if schema says DATE, try harder to parse as DATE.
        declared_date_hint = "DATE" in declared_upper or "TIMESTAMP" in declared_upper

        if numeric_ratio > 0.8 and not declared_date_hint:
            semantic_type = "NUMERIC"
            stats.update(
                {
                    "count": int(numeric_series.notna().sum()),
                    "mean": float(numeric_series.mean(skipna=True) or 0),
                    "std": float(numeric_series.std(skipna=True) or 0),
                    "min": float(numeric_series.min(skipna=True) or 0),
                    "max": float(numeric_series.max(skipna=True) or 0),
                }
            )
        else:
            detected_format = infer_date_format(series)
            if detected_format:
                date_series = pd.to_datetime(series, errors="coerce", format=detected_format)
                date_ratio = float(date_series.notna().mean()) if row_count else 0.0
            else:
                date_series = pd.to_datetime(series, errors="coerce", format="mixed")
                date_ratio = float(date_series.notna().mean()) if row_count else 0.0

            if date_ratio > 0.7 or (declared_date_hint and date_ratio > 0.3):
                semantic_type = "DATE"
                semantic_role = "TEMPORAL"
            else:
                semantic_type = "CATEGORICAL"

        avg_len, std_len = _length_stats(series if semantic_type != "NUMERIC" else series.astype(str))
        code_ratio = _code_like_ratio(series if semantic_type != "NUMERIC" else numeric_series)
        stats.update({"avg_len": avg_len, "std_len": std_len, "code_ratio": code_ratio, "date_ratio": date_ratio})

        top1_ratio = 0.0
        entropy = 0.0
        top_values: dict[str, int] = {}

        is_text_like = False
        if semantic_type == "CATEGORICAL":
            value_counts = series.value_counts(dropna=True)
            total = float(value_counts.sum() or 0)
            if total > 0:
                counts = value_counts.values.astype(float)
                entropy = _entropy_from_counts(counts)
                top1_ratio = float(value_counts.iloc[0] / total)
                top_values = {str(idx): int(cnt) for idx, cnt in value_counts.head(50).items()}
            is_text_like = avg_len >= 12 and cardinality <= (row_count * 0.5)

        stats.update({"top1_ratio": top1_ratio, "entropy": entropy, "top_values": top_values})

        numeric_for_id = numeric_series if semantic_type == "NUMERIC" else pd.to_numeric(series, errors="coerce")
        is_identifier = _assess_identifier(
            col=str(column),
            semantic_type=semantic_type,
            unique_ratio=unique_ratio,
            cardinality=cardinality,
            numeric_series=numeric_for_id,
            code_ratio=code_ratio,
            avg_len=avg_len,
            schema_hint=hint,
        )

        if semantic_type == "NUMERIC":
            semantic_role = "METRIC"
        elif semantic_type == "DATE":
            semantic_role = "TEMPORAL"
        else:
            if is_identifier:
                semantic_role = "IDENTIFIER"
            elif is_text_like and cardinality > 10:
                semantic_role = "TEXT"
            else:
                semantic_role = "CATEGORY"

        profiles.append(
            {
                "name": str(column),
                "type": semantic_type,
                "cardinality": cardinality,
                "null_ratio": null_ratio,
                "stats": stats,
                "is_id": semantic_role == "IDENTIFIER",
                "semantic_role": semantic_role,
                "unique_ratio": unique_ratio,
            }
        )

    return profiles


def _find_strongest_correlation(df, numeric_columns: list[str]) -> dict[str, Any] | None:
    if len(numeric_columns) < 2:
        return None

    numeric_df = df[numeric_columns].apply(pd.to_numeric, errors="coerce")
    corr_matrix = numeric_df.corr().abs()
    if corr_matrix.empty:
        return None

    corr_array = corr_matrix.values.copy()
    np.fill_diagonal(corr_array, 0)
    corr_matrix = pd.DataFrame(corr_array, index=corr_matrix.index, columns=corr_matrix.columns)
    max_corr = corr_matrix.unstack().dropna().sort_values(ascending=False)
    if max_corr.empty:
        return None

    pair = max_corr.index[0]
    return {"x": pair[0], "y": pair[1], "correlation": float(max_corr.iloc[0])}


def suggest_charts(df, schema_hints: Mapping[str, Mapping[str, Any]] | None = None, sql: str | None = None) -> list[dict[str, Any]]:
    """Generate chart suggestions.

    Output format matches the frontend's expectations.
    """
    profiles = profile_dataframe(df, schema_hints=schema_hints)
    row_count = len(df)

    is_grouped = False
    if sql:
        is_grouped = "GROUP BY" in sql.upper()

    numeric_cols = [
        p
        for p in profiles
        if p.get("semantic_role") == "METRIC" and float(p["stats"].get("std") or 0) > 0
    ]

    categorical_cols: list[dict[str, Any]] = []
    for p in profiles:
        role = p.get("semantic_role")
        if role == "IDENTIFIER":
            continue
        if p["type"] != "CATEGORICAL":
            continue
        # Skip long-text categories unless query is pre-aggregated
        if role == "TEXT" and p["cardinality"] > 10 and not is_grouped:
            continue
        if p["cardinality"] < 2 or p["cardinality"] > 50:
            continue
        # Skip near-unique categories unless query is pre-aggregated
        if not is_grouped and (p["cardinality"] / max(1, row_count)) > 0.8:
            continue
        categorical_cols.append(p)

    date_cols = [p for p in profiles if p.get("semantic_role") == "TEMPORAL"]

    suggestions: list[dict[str, Any]] = []

    # (A) Prefer interpretable relationships over pure distributions.

    # A1) Time series.
    if date_cols and numeric_cols:
        metric = numeric_cols[0]["name"]
        date_col = date_cols[0]["name"]
        date_cardinality = date_cols[0].get("cardinality", row_count)
        needs_agg = date_cardinality < row_count * 0.8
        suggestion = {
            "type": "line",
            "priority": 1,
            "score": float(numeric_cols[0]["stats"].get("std") or 0),
            "x": date_col,
            "y": [f"Avg {metric}"] if needs_agg else [metric],
            "reason": "Time series data detected",
            "icon": "📈",
            "description": f"Trend of {metric} over {date_col}",
        }
        if needs_agg:
            suggestion["transform"] = {
                "type": "aggregate",
                "method": "avg",
                "groupBy": date_col,
                "column": metric,
                "label": f"Avg {metric}",
                "limit": min(date_cardinality, 50),
                "sort": "asc",
            }
        suggestions.append(suggestion)

    # A2) Category + metric.
    if categorical_cols and numeric_cols:
        metric = numeric_cols[0]
        metric_std = float(metric["stats"].get("std") or 0)

        ranked_cats = sorted(
            categorical_cols,
            key=lambda cat: 0.6 * float(cat["stats"].get("entropy") or 0)
            - (0.15 if cat["cardinality"] > 15 else 0),
            reverse=True,
        )

        for cat in ranked_cats[:2]:
            entropy = float(cat["stats"].get("entropy") or 0)
            null_penalty = 0.6 if cat["null_ratio"] > 0.3 else 1
            readability_penalty = 0.75 if cat["cardinality"] > 15 else 1
            blend_score = (0.6 * entropy + 0.4 * metric_std) * null_penalty * readability_penalty

            # Pre-aggregated: show data directly
            if is_grouped:
                suggestions.append(
                    {
                        "type": "bar",
                        "priority": 1 if cat["cardinality"] <= 10 else 2,
                        "score": blend_score,
                        "x": cat["name"],
                        "y": [metric["name"]],
                        "reason": f"Compare {metric['name']} across {cat['cardinality']} categories",
                        "icon": "📊",
                        "description": f"{metric['name']} by {cat['name']}",
                    }
                )
            else:
                suggestions.append(
                    {
                        "type": "bar",
                        "priority": 1 if cat["cardinality"] <= 10 else 2,
                        "score": blend_score,
                        "x": cat["name"],
                        "y": [f"Avg {metric['name']}"],
                        "reason": f"Compare {metric['name']} across {cat['cardinality']} categories",
                        "icon": "📊",
                        "description": f"Average {metric['name']} by {cat['name']}",
                        "transform": {
                            "type": "aggregate",
                            "method": "avg",
                            "groupBy": cat["name"],
                            "column": metric["name"],
                            "label": f"Avg {metric['name']}",
                            "limit": min(cat["cardinality"], 15),
                            "sort": "desc",
                        },
                    }
                )

    # A3) Stacked (two categorical + numeric)
    if len(categorical_cols) >= 2 and numeric_cols:
        cat1, cat2 = categorical_cols[:2]
        if cat1["cardinality"] <= 10 and cat2["cardinality"] <= 6:
            suggestions.append(
                {
                    "type": "stackedBar",
                    "priority": 2,
                    "score": float(numeric_cols[0]["stats"].get("std") or 0),
                    "x": cat1["name"],
                    "y": [numeric_cols[0]["name"]],
                    "stack": cat2["name"],
                    "reason": f"Breakdown of {numeric_cols[0]['name']} by two categories",
                    "icon": "📊",
                    "description": f"{numeric_cols[0]['name']} by {cat1['name']} and {cat2['name']}",
                    "transform": {
                        "type": "aggregateStacked",
                        "groupBy": cat1["name"],
                        "stackBy": cat2["name"],
                        "column": numeric_cols[0]["name"],
                        "method": "avg",
                        "groupLimit": min(cat1["cardinality"], 10),
                        "stackLimit": min(cat2["cardinality"], 6),
                        "sort": "desc",
                    },
                }
            )

    # (B) Then add distributions as secondary insights.

    for profile in numeric_cols[:2]:
        if float(profile["stats"].get("std") or 0) <= 0:
            continue
        suggestions.append(
            {
                "type": "bar",
                "priority": 3,
                "score": float(profile["stats"].get("std") or 0),
                "transform": {
                    "type": "histogram",
                    "column": profile["name"],
                    "bins": min(20, max(5, int(math.sqrt(profile["stats"].get("count", row_count) or row_count)))),
                },
                "reason": "Numeric distribution",
                "icon": "📊",
                "description": f"Distribution of {profile['name']}",
            }
        )

    for profile in [c for c in categorical_cols if c["cardinality"] <= 25][:2]:
        entropy = float(profile["stats"].get("entropy") or 0)
        null_penalty = 0.6 if profile["null_ratio"] > 0.3 else 1
        readability_penalty = 0.75 if profile["cardinality"] > 15 else 1
        top = min(profile["cardinality"], 20)
        suggestions.append(
            {
                "type": "bar",
                "priority": 3,
                "score": max(entropy, 0.1) * null_penalty * readability_penalty,
                "transform": {
                    "type": "categoricalCounts",
                    "column": profile["name"],
                    "top": top,
                    "includeOther": top < profile["cardinality"],
                },
                "reason": "Category frequency",
                "icon": "📊",
                "description": f"Record count by {profile['name']}",
            }
        )

    # (C) Scatter for correlation.
    if len(numeric_cols) >= 2:
        corr_pair = _find_strongest_correlation(df, [c["name"] for c in numeric_cols])
        if corr_pair:
            suggestions.append(
                {
                    "type": "scatter",
                    "priority": 4,
                    "score": float(corr_pair["correlation"]),
                    "x": corr_pair["x"],
                    "y": corr_pair["y"],
                    "reason": "Correlation analysis",
                    "icon": "🔵",
                    "description": f"{corr_pair['y']} vs {corr_pair['x']}",
                }
            )

    suggestions.sort(key=lambda s: ((s.get("priority") or 99), -(s.get("score") or 0)))

    # De-dupe (type + x + y + transform+column)
    unique: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for s in suggestions:
        key = (
            str(s.get("type")),
            str(s.get("x") or ""),
            str(s.get("transform", {}).get("column") or ""),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(s)

    return unique[:8]
