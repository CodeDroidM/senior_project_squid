# SQUID - SQL Query Interface for Data

A web application for running SQL queries against databases through the DbSrc Agent. Built with a React frontend and a FastAPI backend.

---

## Quick Start (Docker)

The fastest way to run SQUID is with Docker Compose.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### 1. Clone the repository

```bash
git clone https://github.com/CodeDroidM/senior_project_squid.git
cd senior_project_squid
```

### 2. Start the app

```bash
docker compose up 
```

This launches the **backend** at http://localhost:8000.

> The frontend service is included in `docker-compose.yml` but commented out by default. To also run the frontend in Docker, uncomment the `frontend` service block and re-run the command above.

### 3. Open the UI

If you are running the frontend locally (see below) or have uncommented the frontend service, open http://localhost:3000.

---

## Local Development (without Docker)

### Prerequisites

- Python 3.9+
- Node.js 18+
- Access to a DbSrc Agent

### Backend

```bash
cd server
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn squid_backend:app --reload --host 0.0.0.0 --port 8000
```

The API runs at http://localhost:8000.

### Frontend

```bash
cd frontend
yarn install
yarn start
```

The app opens at http://localhost:3000.

---

## Configuration

The backend reads the following environment variables (all optional — sensible defaults are built in):

| Variable | Default | Description |
|---|---|---|
| `DBSRC_AGENT_HOST` | `www.compute-mertjiandata.com` | DbSrc Agent hostname |
| `DBSRC_AGENT_PORT` | `9000` | DbSrc Agent port |
| `DBSRC_CLIENT_HOST` | `127.0.0.1` | IP address sent to the agent |

These are set in the `environment:` block of `docker-compose.yml` for Docker, or can be exported in your shell for local development.

---

## How to Use

1. Open http://localhost:3000 in a browser.
2. Log in with your DbSrc username and password.
3. Select an ACCP schema to connect to.
   - ROLE-based ACCPs will send a one-time password to your email.
4. Write SQL queries in the editor and click **Run**.
5. View results in the table below the editor.
6. Export results as Excel, JSON, or XML.
7. Click output to see auto-generated chart suggestions and queried tables.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React, Material UI, CodeMirror, Chart.js |
| **Backend** | FastAPI, pandas, uvicorn |
| **Infrastructure** | Docker, Docker Compose |
