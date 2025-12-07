"""SQUID backend: FastAPI wrapper that forwards commands to the DbSrc Agent.

Endpoints:
- POST /connect       -> connect to agent, authenticate, bind ACCP
- GET  /access        -> show accessible objects for the configured user
- POST /query         -> run SQL query via agent and return JSON
- POST /disconnect    -> disconnect ACCP and agent

This file uses the existing `DbSrcConnector` in `dbsrc_sqlalchemy_example.py`.
Hardcoded values (ACCP ID, username, password, token examples) are placed at top
so they can be later replaced by frontend-provided parameters.
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import os
import json
import jwt
import datetime
from typing import Any, Optional

from server.dbsrc_sqlalchemy import DbSrcConnector

# === Hardcoded defaults (replaceable later) ===
DEFAULT_AGENT_HOST = os.environ.get("DBSRC_AGENT_HOST", "www.compute-mertjiandata.com")
DEFAULT_AGENT_PORT = int(os.environ.get("DBSRC_AGENT_PORT", "9000"))
DEFAULT_USERNAME = os.environ.get("DBSRC_USERNAME", "ivan")
DEFAULT_USER_PASSWORD = os.environ.get("DBSRC_USER_PASSWORD", "Rc3e4745c$4")
DEFAULT_ACCP_ID = os.environ.get("DBSRC_ACCP_ID", "345")
DEFAULT_HOST_IP = os.environ.get("DBSRC_CLIENT_HOST", "127.0.0.1")


class QueryRequest(BaseModel):
    sql: str

class ConnectRequest(BaseModel):
    username: str
    password: str
    accp_id: str
    host_ip: Optional[str] = "127.0.0.1"


app = FastAPI(title="SQUID - DbSrc Backend")

# JWT Secret Key (in production, use a proper secret)
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "squid-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Security
security = HTTPBearer()

# Single global connector for now (keeps socket open between calls).
connector: DbSrcConnector | None = None
current_user_info: dict | None = None


def get_connector() -> DbSrcConnector:
    global connector
    if connector is None:
        connector = DbSrcConnector(host=DEFAULT_AGENT_HOST, port=DEFAULT_AGENT_PORT)
    return connector


def create_access_token(data: dict):
    """Create a JWT token with expiration."""
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token and return user info."""
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.post("/connect")
def connect(request: ConnectRequest):
    """Connect to the DbSrc Agent, authenticate the user, and bind ACCP session."""
    global current_user_info
    
    c = get_connector()
    try:
        c.connect_agent()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent connect failed: {e}")

    try:
        agent_token = c.authenticate_user(request.username, request.password)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")

    try:
        c.connect_accp(request.accp_id, request.username, host_ip=request.host_ip)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ACCP connect failed: {e}")

    # Store user info for this session
    current_user_info = {
        "username": request.username,
        "accp_id": request.accp_id,
        "host_ip": request.host_ip
    }

    # Create JWT token
    access_token = create_access_token(data={"sub": request.username, "accp_id": request.accp_id})
    
    return {
        "status": "connected", 
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in_hours": JWT_EXPIRATION_HOURS
    }


@app.get("/access")
def show_access(current_user: dict = Depends(verify_token)):
    """Return the access objects available for the configured user."""
    c = get_connector()
    try:
        username = current_user.get("sub")
        resp = c.show_access(username)
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"show_access failed: {e}")


@app.post("/query")
def run_query(req: QueryRequest, current_user: dict = Depends(verify_token)):
    """Execute a SQL query through the DbSrc Agent and return parsed JSON response."""
    c = get_connector()
    try:
        resp = c.run_sql(req.sql)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"run_sql failed: {e}")

    # Ensure response is JSON serializable
    try:
        json.dumps(resp)
    except Exception:
        resp = {"err_code": "99", "err_msg": "Non-serializable response", "raw": str(resp)}

    return resp


@app.post("/disconnect")
def disconnect():
    """Disconnect ACCP session and the agent."""
    global connector
    if connector is None:
        return {"status": "already-disconnected"}

    try:
        connector.disconnect()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Disconnect failed: {e}")
    finally:
        connector = None

    return {"status": "disconnected"}
