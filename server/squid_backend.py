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
from typing import Any
from datetime import datetime, timedelta

try:
    from server.dbsrc_sqlalchemy import DbSrcConnector
except ModuleNotFoundError:
    from dbsrc_sqlalchemy import DbSrcConnector

DEFAULT_AGENT_HOST = os.environ.get("DBSRC_AGENT_HOST", "www.compute-mertjiandata.com")
DEFAULT_AGENT_PORT = int(os.environ.get("DBSRC_AGENT_PORT", "9000"))
DEFAULT_USERNAME = os.environ.get("DBSRC_USERNAME", "ivan")
DEFAULT_USER_PASSWORD = os.environ.get("DBSRC_USER_PASSWORD", "Rc3e4745c$4")
DEFAULT_ACCP_ID = os.environ.get("DBSRC_ACCP_ID", "345")
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
    
    try:
        connector.connect_accp(req.accp_id, current_username, host_ip=req.client_host)
        
        connection_timestamp = datetime.now()

        return {
            "status": "connected", 
            "username": current_username,
            "accp_id": req.accp_id,
            "expires_in_hours": TOKEN_EXPIRY_HOURS
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ACCP connection failed: {e}")


@app.get("/access")
def show_access():
    """Return the access objects available for the configured user."""
    global current_username
    c = get_connector()
    
    if not current_username:
        raise HTTPException(status_code=400, detail="No user authenticated")
    
    try:
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
            
            return result
        except Exception as e:
            print(f"❌ Query execution failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))


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
