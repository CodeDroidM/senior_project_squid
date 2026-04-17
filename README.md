# SQUID - SQL Query Interface for Data

A web application for running SQL queries against databases through the DbSrc Agent. Built with a React frontend and a FastAPI backend.

## Prerequisites

- Python 3.9+
- Node.js 18+
- Access to a DbSrc Agent

## Installation

### Backend

```bash
cd server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
DBSRC_AGENT_HOST= hostname
DBSRC_AGENT_PORT=9000
DBSRC_CLIENT_HOST=127.0.0.1
```

## Running

Start the backend and frontend in separate terminals:

```bash
# Backend
cd server
source venv/bin/activate
uvicorn squid_backend:app --reload --host 0.0.0.0 --port 8000
```

```bash
# Frontend
cd frontend
npm start
```

The app opens at http://localhost:3000. The API runs at http://localhost:8000.

## Docker

```bash
docker compose up --build
```

## How to Use

1. Open http://localhost:3000 in a browser.
2. Log in with your DbSrc username and password.
3. Select an ACCP schema to connect to.
   - ROLE-based ACCPs will send a one-time password to your email.
4. Write SQL queries in the editor and click Run.
5. View results in the table below the editor.
6. Export results as Excel, JSON, or XML.
7. Click Visualize to see auto-generated chart suggestions.

## Technology Stack

- **Frontend:** React, Material UI, CodeMirror, Chart.js
- **Backend:** FastAPI, pandas, PyJWT, uvicorn
