"""SQUID backend: FastAPI wrapper for DbSrc Agent.

Endpoints:
- POST /validate-user  -> authenticate user and return available ACCPs
- POST /connect        -> connect to specific ACCP
- GET  /access         -> show accessible objects
- POST /query          -> execute SQL query
- POST /disconnect     -> disconnect from ACCP and agent
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import threading
import math
from typing import Any
from datetime import datetime, timedelta
import re

import numpy as np

try:
    import pandas as pd
except ImportError:  # pragma: no cover - pandas is optional but recommended
    pd = None

try:
    # Server-side source of truth for suggestions
    from server.chart_detector import suggest_charts
except ModuleNotFoundError:
    from chart_detector import suggest_charts

try:
    from server.dbsrc_sqlalchemy import DbSrcConnector
except ModuleNotFoundError:
    from dbsrc_sqlalchemy import DbSrcConnector

DEFAULT_AGENT_HOST = os.environ.get("DBSRC_AGENT_HOST", "www.compute-mertjiandata.com")
DEFAULT_AGENT_PORT = int(os.environ.get("DBSRC_AGENT_PORT", "9000"))
DEFAULT_HOST_IP = os.environ.get("DBSRC_CLIENT_HOST", "127.0.0.1")


class ConnectRequest(BaseModel):
    accp_id: str = None
    client_host: str = DEFAULT_HOST_IP


class AccpInfo(BaseModel):
    accp_id: str
    schema_name: str
    description: str = None


class QueryRequest(BaseModel):
    sql: str


app = FastAPI(title="SQUID - DbSrc Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connector: DbSrcConnector | None = None
current_username: str | None = None
current_token: str | None = None
connection_timestamp: datetime | None = None
TOKEN_EXPIRY_HOURS = 24

connector_lock = threading.Lock()


def get_connector() -> DbSrcConnector:
    global connector, connection_timestamp
    if connector is None:
        raise HTTPException(status_code=400, detail="Not connected to agent. Please connect first.")
    
    if connection_timestamp is not None:
        elapsed = datetime.now() - connection_timestamp
        if elapsed > timedelta(hours=TOKEN_EXPIRY_HOURS):
            connector = None
            connection_timestamp = None
            raise HTTPException(status_code=401, detail="Session expired. Please login again.")
    
    return connector


@app.post("/validate-user")
def validate_user(req: dict):
    """Step 1: Validate user credentials and get token + available ACCPs."""
    global connector, current_username, current_token
    
    username = req.get("username")
    password = req.get("password")
    
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    
    if connector:
        try:
            connector.disconnect()
        except:
            pass
    
    connector = DbSrcConnector(
        host=DEFAULT_AGENT_HOST, 
        port=DEFAULT_AGENT_PORT,
        agent_password=os.environ.get("DBSRC_AGENT_PASSWORD", "dbsrc$admin2024!")
    )
    
    try:
        connector.connect_agent()
        
        token = connector.authenticate_user(username, password)
        current_token = token
        current_username = username
        
        accps = connector.list_user_accps(username)
        
        return {
            "status": "user_validated",
            "username": username,
            "token": token,
            "available_accps": accps
        }
        
    except Exception as e:
        if connector:
            connector.disconnect()
            connector = None
        current_username = None
        current_token = None
        raise HTTPException(status_code=401, detail=f"User validation failed: {e}")


@app.post("/connect")
def connect(req: ConnectRequest):
    """Step 2: Connect to specific ACCP using validated user."""
    global connector, current_username, current_token, connection_timestamp
    
    if not req.accp_id:
        raise HTTPException(status_code=400, detail="ACCP ID is required")
    
    if not connector or not current_token:
        raise HTTPException(status_code=400, detail="User not validated. Call /validate-user first.")
    
    if not current_username:
        raise HTTPException(status_code=400, detail="No authenticated user found")
    
    with connector_lock:
        try:
            result = connector.connect_accp(
                req.accp_id, 
                current_username, 
                host_ip=req.client_host
            )
            
            connection_timestamp = datetime.now()

            return {
                "status": "connected", 
                "username": current_username,
                "accp_id": req.accp_id,
                "schema_name": result.get("schema_name"),
                "expires_in_hours": TOKEN_EXPIRY_HOURS
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ACCP connection failed: {e}")


@app.post("/set-role")
def set_role(req: dict):
    """Execute ALTER SESSION SET ROLE for ROLE-based ACCP authentication.
    
    Request body:
        {
            "role_name": "ACCP_DISCIPLUS_LIVE_R_9921",
            "role_password": "HDFDGEA"
        }
    """
    c = get_connector()
    
    role_name = req.get("role_name")
    role_password = req.get("role_password")
    
    if not role_name or not role_password:
        raise HTTPException(status_code=400, detail="role_name and role_password are required")
    
    try:
        with connector_lock:
            result = c.set_role(role_name, role_password)
        
        if result.get("err_code") != "0":
            raise HTTPException(
                status_code=401, 
                detail=f"ROLE activation failed: {result.get('err_msg')}"
            )
        
        return {
            "status": "role_activated",
            "role_name": role_name,
            "message": result.get("err_msg", "ROLE activated successfully")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ROLE activation error: {e}")


@app.get("/access")
def show_access():
    """Return the access objects available for the configured user."""
    global current_username
    c = get_connector()
    
    if not current_username:
        raise HTTPException(status_code=400, detail="No user authenticated")
    
    try:
        with connector_lock:
            resp = c.show_access(current_username)
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"show_access failed: {e}")


@app.post("/query")
async def execute_sql_query(query_request: QueryRequest):
    """Execute SQL query and return results."""
    if not connector or not connector.socket:
        raise HTTPException(status_code=400, detail="Not connected to DbSrc Agent")
    
    with connector_lock:
        try:
            result = connector.run_sql(query_request.sql)
            
            if result.get("err_code") == "99":
                return {
                    "err_code": "1",
                    "err_msg": result.get("err_msg", "Query result is too large. Please add FETCH FIRST n ROWS ONLY or WHERE clause."),
                    "data": [],
                    "columns": [],
                    "details": {
                        "raw_length": result.get("raw_length", 0),
                        "suggestion": "Try adding: FETCH FIRST 100 ROWS ONLY to your query"
                    }
                }
            
            augment_with_chart_suggestions(result, sql=query_request.sql)
            return result
        except Exception as e:
            print(f"❌ Query execution failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@app.post("/switch-accp")
def switch_accp(req: ConnectRequest):
    """Switch to a different ACCP without full logout.

    Disconnects the current ACCP session on the agent side, then connects
    to the new ACCP using the already-authenticated token.  The agent
    connection and user credentials are preserved.
    """
    global connector, current_username, current_token, connection_timestamp

    if not req.accp_id:
        raise HTTPException(status_code=400, detail="ACCP ID is required")

    if not connector or not current_token:
        raise HTTPException(status_code=400, detail="No active session. Please login first.")

    if not current_username:
        raise HTTPException(status_code=400, detail="No authenticated user found")

    try:
        # 1. Disconnect current ACCP only (keep agent connection alive)
        disconnect_req = {
            "password": __import__("base64").b64encode(
                connector.agent_password.encode()
            ).decode(),
            "action": "disconnect.accp",
        }
        try:
            with connector_lock:
                connector._send_and_receive(disconnect_req)
        except Exception as e:
            print(f"⚠️ ACCP disconnect warning (continuing): {e}")

        # 2. Connect to the new ACCP using the existing token
        with connector_lock:
            result = connector.connect_accp(
            req.accp_id,
            current_username,
            host_ip=req.client_host,
        )

        connection_timestamp = datetime.now()

        return {
            "status": "switched",
            "username": current_username,
            "accp_id": req.accp_id,
            "schema_name": result.get("schema_name"),
            "expires_in_hours": TOKEN_EXPIRY_HOURS,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ACCP switch failed: {e}")


@app.get("/session-info")
def session_info():
    """Return current session state (used by Change ACCP flow)."""
    global current_username, current_token, connection_timestamp
    if not current_token:
        raise HTTPException(status_code=401, detail="No active session")

    # Re-fetch available ACCPs for the current user so the UI can show the selector
    try:
        c = get_connector()
        with connector_lock:
            accps = c.list_user_accps(current_username)
    except Exception as e:
        accps = []
        print(f"⚠️ Could not fetch ACCPs for session-info: {e}")

    return {
        "username": current_username,
        "token": current_token,
        "available_accps": accps,
    }


@app.post("/disconnect")
def disconnect():
    """Disconnect ACCP session and the agent."""
    global connector, current_username, current_token, connection_timestamp
    if connector is None:
        return {"status": "already-disconnected"}

    try:
        connector.disconnect()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Disconnect failed: {e}")
    finally:
        connector = None
        current_username = None
        current_token = None
        connection_timestamp = None

    return {"status": "disconnected"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)


def augment_with_chart_suggestions(result: dict[str, Any], sql: str | None = None) -> None:
    """Attach chart suggestions generated via pandas profiling to the query result."""
    if pd is None:
        return

    data = result.get("data")
    columns = result.get("columns")
    if not data or not columns:
        return

    # Handle serialized JSON payloads
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            return

    if not isinstance(data, list) or len(data) == 0:
        return

    try:
        df = pd.DataFrame(data)
    except Exception:
        return

    if df.empty:
        return

    suggestions = suggest_charts(df, sql=sql)
    if suggestions:
        result["chart_suggestions"] = suggestions


def generate_chart_suggestions_from_df(df) -> list[dict[str, Any]]:
    """Generate visualization suggestions using pandas profiling."""
    profiles = profile_dataframe(df)
    row_count = len(df)
    numeric_cols = [
        p for p in profiles
        if p.get("semantic_role") == "METRIC"
        and float(p["stats"].get("std") or 0) > 0
    ]
    categorical_cols = []
    for p in profiles:
        role = p.get("semantic_role")
        if role == "IDENTIFIER":
            continue
        if p["type"] != "CATEGORICAL" and role != "TEXT":
            continue
        if role == "TEXT" and p["cardinality"] > 25:
            continue
        if p["cardinality"] < 2 or p["cardinality"] > 80:
            continue
        cardinality_ratio = p["cardinality"] / max(1, row_count)
        top1_ratio = float(p["stats"].get("top1_ratio") or 0)
        if cardinality_ratio > 0.95 and top1_ratio >= 0.95:
            continue
        categorical_cols.append(p)
    date_cols = [p for p in profiles if p.get("semantic_role") == "TEMPORAL"]

    suggestions: list[dict[str, Any]] = []

    # Numeric distributions (histograms)
    for profile in numeric_cols[:3]:
        if profile["stats"].get("std") == 0:
            continue
        suggestions.append({
            "type": "bar",
            "priority": 2,
            "score": float(profile["stats"].get("std") or 0),
            "transform": {
                "type": "histogram",
                "column": profile["name"],
                "bins": min(20, max(5, int(math.sqrt(profile["stats"].get("count", row_count) or row_count))))
            },
            "reason": "Numeric distribution detected",
            "icon": "📊",
            "description": f"Distribution of {profile['name']}"
        })

    # Categorical counts
    count_candidates = [c for c in categorical_cols if c["cardinality"] <= 25][:3]
    for profile in count_candidates:
        entropy = float(profile["stats"].get("entropy") or 0)
        null_penalty = 0.6 if profile["null_ratio"] > 0.3 else 1
        readability_penalty = 0.75 if profile["cardinality"] > 15 else 1
        top = min(profile["cardinality"], 20)
        suggestions.append({
            "type": "bar",
            "priority": 2,
            "score": max(entropy, 0.1) * null_penalty * readability_penalty,
            "transform": {
                "type": "categoricalCounts",
                "column": profile["name"],
                "top": top,
                "includeOther": top < profile["cardinality"]
            },
            "reason": "Categorical distribution",
            "icon": "📊",
            "description": f"Record count by {profile['name']}"
        })

    # Time series
    if date_cols and numeric_cols:
        metric = numeric_cols[0]["name"]
        date_col = date_cols[0]["name"]
        suggestions.append({
            "type": "line",
            "priority": 1,
            "score": float(numeric_cols[0]["stats"].get("std") or 0),
            "x": date_col,
            "y": [metric],
            "reason": "Time series data detected",
            "icon": "📈",
            "description": f"Trend of {metric} over {date_col}"
        })

    # Category + metric comparisons with aggregation
    if categorical_cols and numeric_cols:
        metric = numeric_cols[0]
        metric_std = float(metric["stats"].get("std") or 0)
        ranked_cats = sorted(
            categorical_cols,
            key=lambda cat: 0.6 * float(cat["stats"].get("entropy") or 0) - (0.15 if cat["cardinality"] > 15 else 0),
            reverse=True
        )

        for cat in ranked_cats[:2]:
            entropy = float(cat["stats"].get("entropy") or 0)
            top1_ratio = float(cat["stats"].get("top1_ratio") or 0)
            null_penalty = 0.6 if cat["null_ratio"] > 0.3 else 1
            readability_penalty = 0.75 if cat["cardinality"] > 15 else 1
            blend_score = (0.6 * entropy + 0.4 * metric_std) * null_penalty * readability_penalty
            suggestions.append({
                "type": "bar",
                "priority": 1 if cat["cardinality"] <= 10 else 2,
                "score": blend_score,
                "x": cat["name"],
                "y": [f"Avg {metric['name']}"] ,
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
                    "sort": "desc"
                }
            })

            if 2 <= cat["cardinality"] <= 6 and top1_ratio < 0.85:
                suggestions.append({
                    "type": "pie",
                    "priority": 2,
                    "score": max(entropy, 0.1) * null_penalty,
                    "labels": "category",
                    "values": "count",
                    "reason": "Balanced category distribution",
                    "icon": "🥧",
                    "description": f"Record distribution by {cat['name']}",
                    "transform": {
                        "type": "categoricalCounts",
                        "column": cat["name"],
                        "top": cat["cardinality"],
                        "includeOther": False
                    }
                })

    # Additional categorical summaries (counts)
    for cat in categorical_cols[3:5]:
        top = min(cat["cardinality"], 15)
        suggestions.append({
            "type": "bar",
            "priority": 2,
            "score": float(cat["stats"].get("entropy") or 0),
            "x": "category",
            "y": ["count"],
            "reason": f"Record count by {cat['name']}",
            "icon": "📊",
            "description": f"Record count by {cat['name']}",
            "transform": {
                "type": "categoricalCounts",
                "column": cat["name"],
                "top": top,
                "includeOther": top < cat["cardinality"]
            }
        })

    # Multi-metric comparisons on a single category
    if categorical_cols and len(numeric_cols) >= 2:
        cat = categorical_cols[0]
        metric_bundle = numeric_cols[: min(3, len(numeric_cols))]
        metric_labels = [f"Avg {metric['name']}" for metric in metric_bundle]
        aggregate_metrics = [
            {
                "column": metric["name"],
                "method": "avg",
                "label": f"Avg {metric['name']}"
            }
            for metric in metric_bundle
        ]
        comparison_score = sum(float(metric["stats"].get("std") or 0) for metric in metric_bundle)
        suggestions.append({
            "type": "bar",
            "priority": 1 if cat["cardinality"] <= 12 else 2,
            "score": comparison_score,
            "x": cat["name"],
            "y": metric_labels,
            "reason": f"Compare {' vs '.join(metric['name'] for metric in metric_bundle)} by {cat['name']}",
            "icon": "📊",
            "description": f"Average metrics by {cat['name']}",
            "transform": {
                "type": "aggregate",
                "groupBy": cat["name"],
                "metrics": aggregate_metrics,
                "limit": min(cat["cardinality"], 12),
                "sort": "desc"
            }
        })

        if cat["cardinality"] <= 12:
            suggestions.append({
                "type": "line",
                "priority": 2,
                "score": comparison_score * 0.8,
                "x": cat["name"],
                "y": metric_labels,
                "reason": f"Trend comparison across {cat['name']}",
                "icon": "📈",
                "description": f"Trend of metrics by {cat['name']}",
                "transform": {
                    "type": "aggregate",
                    "groupBy": cat["name"],
                    "metrics": aggregate_metrics,
                    "limit": min(cat["cardinality"], 12),
                    "sort": "asc"
                }
            })

    # Stacked bars (two categorical + numeric)
    if len(categorical_cols) >= 2 and numeric_cols:
        cat1, cat2 = categorical_cols[:2]
        if cat1["cardinality"] <= 10 and cat2["cardinality"] <= 6:
            suggestions.append({
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
                    "sort": "desc"
                }
            })

    # Correlation / scatter plot
    if len(numeric_cols) >= 2:
        corr_pair = find_strongest_correlation(df, [c["name"] for c in numeric_cols])
        if corr_pair:
            suggestions.append({
                "type": "scatter",
                "priority": 3,
                "score": float(corr_pair["correlation"]),
                "x": corr_pair["x"],
                "y": corr_pair["y"],
                "reason": "Correlation analysis",
                "icon": "🔵",
                "description": f"{corr_pair['y']} vs {corr_pair['x']}"
            })

    suggestions.sort(key=lambda s: ((s.get("priority") or 99), -(s.get("score") or 0)))
    return suggestions[:8]


DATE_FORMAT_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"^\d{4}-\d{2}-\d{2}$"), "%Y-%m-%d"),
    (re.compile(r"^\d{2}/\d{2}/\d{4}$"), "%m/%d/%Y"),
    (re.compile(r"^\d{4}/\d{2}/\d{2}$"), "%Y/%m/%d"),
    (re.compile(r"^\d{2}-\d{2}-\d{4}$"), "%m-%d-%Y"),
    (re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$"), "%Y-%m-%dT%H:%M:%S"),
]


def infer_date_format(series, sample_size: int = 50) -> str | None:
    if series is None or len(series) == 0:
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


IDENTIFIER_NAME_HINTS = [
    re.compile(r"(^|_)(ID|ROWID|UUID|GUID|KEY)$"),
    re.compile(r"(REG|FILE|DOC|ACCOUNT|CUSTOMER|CLIENT|STUDENT|EMP|MEMBER|PATIENT)(NUMBER|NO)$"),
    re.compile(r"(REG|FILE|DOC|ACCOUNT|STUDENT|EMP|PATIENT|SERIAL|BATCH)NO$")
]


def is_identifier_name(column_name: str) -> bool:
    upper = column_name.upper()
    normalized = re.sub(r"[^A-Z0-9]", "", upper)
    if upper == 'ID' or upper.endswith('_ID') or upper.startswith('ID_') or ' ID' in upper:
        return True
    for pattern in IDENTIFIER_NAME_HINTS:
        if pattern.search(normalized):
            return True
    return False


def code_like_ratio(series, sample_size: int = 200) -> float:
    if series is None or len(series) == 0:
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


def compute_length_stats(series) -> tuple[float, float]:
    if series is None or len(series) == 0:
        return 0.0, 0.0
    non_null = series.dropna()
    if non_null.empty:
        return 0.0, 0.0
    lengths = non_null.astype(str).str.len()
    if lengths.empty:
        return 0.0, 0.0
    return float(lengths.mean()), float(lengths.std(ddof=0) or 0.0)


def assess_identifier_candidate(
    column_name: str,
    semantic_type: str,
    unique_ratio: float,
    cardinality: int,
    numeric_series,
    code_ratio: float,
    avg_length: float
) -> tuple[bool, float]:
    id_hint = 1.0 if is_identifier_name(column_name) else 0.0
    integer_like = False
    span = 0.0

    if semantic_type == 'NUMERIC' and numeric_series is not None:
        numeric_values = numeric_series.dropna()
        if not numeric_values.empty:
            integer_like = numeric_values.apply(lambda v: float(v).is_integer()).all()
            span = float(numeric_values.max() - numeric_values.min())

    evidence = 0.0

    if unique_ratio >= 0.98 and cardinality >= 20:
        if (semantic_type == 'NUMERIC' and integer_like) or code_ratio >= 0.5 or (avg_length > 0 and avg_length <= 10):
            evidence += 1.0

    if integer_like and unique_ratio >= 0.98 and span > max(100.0, cardinality * 0.5):
        evidence += 0.5

    if code_ratio >= 0.7 and unique_ratio >= 0.9:
        evidence += 1.0

    if unique_ratio >= 0.995 and cardinality >= 50:
        evidence += 1.0

    if evidence == 0.0 and id_hint and unique_ratio >= 0.9 and cardinality >= 15:
        evidence += 0.5

    return evidence >= 1.0, id_hint


def profile_dataframe(df) -> list[dict[str, Any]]:
    profiles: list[dict[str, Any]] = []
    for column in df.columns:
        series = df[column]
        non_null = series.dropna()
        cardinality = int(non_null.nunique())
        non_null_count = len(non_null)
        row_count = len(series)
        null_ratio = float(1 - (non_null_count / row_count if row_count else 0))
        unique_ratio = float(cardinality) / float(non_null_count or 1)

        numeric_series = pd.to_numeric(series, errors='coerce')
        numeric_ratio = float(numeric_series.notna().mean()) if row_count else 0
        stats: dict[str, Any] = {
            "row_count": row_count,
            "cardinality": cardinality,
            "unique_ratio": unique_ratio,
            "null_ratio": null_ratio,
            "sample_values": [str(val) for val in non_null.head(5).tolist()]
        }

        detected_format = None
        date_ratio = 0.0
        semantic_type = 'CATEGORICAL'
        semantic_role = 'CATEGORY'

        if numeric_ratio > 0.8:
            semantic_type = 'NUMERIC'
            stats.update({
                "count": int(numeric_series.notna().sum()),
                "mean": float(numeric_series.mean(skipna=True) or 0),
                "std": float(numeric_series.std(skipna=True) or 0),
                "min": float(numeric_series.min(skipna=True) or 0),
                "max": float(numeric_series.max(skipna=True) or 0)
            })
        else:
            detected_format = infer_date_format(series)
            if detected_format:
                date_series = pd.to_datetime(series, errors='coerce', format=detected_format)
                date_ratio = float(date_series.notna().mean()) if row_count else 0
            else:
                date_series = pd.to_datetime(series, errors='coerce')
                date_ratio = float(date_series.notna().mean()) if row_count else 0

            if date_ratio > 0.7:
                semantic_type = 'DATE'
                semantic_role = 'TEMPORAL'
            else:
                semantic_type = 'CATEGORICAL'

        text_avg_len, text_len_std = compute_length_stats(series if semantic_type != 'NUMERIC' else series.astype(str))
        code_ratio = code_like_ratio(series if semantic_type != 'NUMERIC' else numeric_series)
        stats.update({
            "avg_len": text_avg_len,
            "std_len": text_len_std,
            "code_ratio": code_ratio,
            "date_ratio": date_ratio
        })

        category_entropy = 0.0
        top1_ratio = 0.0
        top_values_dict: dict[str, int] = {}

        if semantic_type == 'CATEGORICAL':
            value_counts = series.value_counts(dropna=True)
            total = float(value_counts.sum() or 0)
            if total > 0:
                top_values = value_counts.head(50)
                category_entropy = 0.0
                for count in value_counts.values:
                    p = float(count) / total
                    category_entropy -= p * math.log2(p)
                top1_ratio = float(value_counts.iloc[0] / total)
                top_values_dict = {str(idx): int(cnt) for idx, cnt in top_values.items()}
            is_text_like = text_avg_len >= 12 and cardinality <= (row_count * 0.5)
        else:
            is_text_like = False

        stats.update({
            "top1_ratio": top1_ratio,
            "entropy": category_entropy,
            "top_values": top_values_dict
        })

        numeric_for_id = numeric_series if semantic_type == 'NUMERIC' else pd.to_numeric(series, errors='coerce')
        is_id_candidate, id_hint = assess_identifier_candidate(
            column_name=column,
            semantic_type=semantic_type,
            unique_ratio=unique_ratio,
            cardinality=cardinality,
            numeric_series=numeric_for_id,
            code_ratio=code_ratio,
            avg_length=text_avg_len
        )

        if semantic_type == 'NUMERIC':
            semantic_role = 'METRIC'
        elif semantic_type == 'DATE':
            semantic_role = 'TEMPORAL'
        else:
            if is_id_candidate:
                semantic_role = 'IDENTIFIER'
            elif is_text_like and cardinality > 10:
                semantic_role = 'TEXT'
            else:
                semantic_role = 'CATEGORY'

        profiles.append({
            "name": column,
            "type": semantic_type,
            "cardinality": cardinality,
            "null_ratio": null_ratio,
            "stats": stats,
            "is_id": semantic_role == 'IDENTIFIER',
            "semantic_role": semantic_role,
            "id_hint": id_hint,
            "unique_ratio": unique_ratio
        })

    return profiles


def find_strongest_correlation(df, numeric_columns: list[str]) -> dict[str, Any] | None:
    if len(numeric_columns) < 2:
        return None

    numeric_df = df[numeric_columns].apply(pd.to_numeric, errors='coerce')
    corr_matrix = numeric_df.corr().abs()
    if corr_matrix.empty:
        return None

    np.fill_diagonal(corr_matrix.values, 0)
    max_corr = corr_matrix.unstack().dropna().sort_values(ascending=False)
    if max_corr.empty:
        return None

    pair = max_corr.index[0]
    return {"x": pair[0], "y": pair[1], "correlation": float(max_corr.iloc[0])}
