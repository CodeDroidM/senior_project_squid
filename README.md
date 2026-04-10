# SQUID - SQL Query Interface for Data# SQL CLI (`sqd_cli.py`)



SQUID is a web application for executing SQL queries through the DbSrc Agent.Simple command-line utility to connect to a database using SQLAlchemy and:

It consists of a React frontend (Material UI) and a FastAPI backend that

communicates with the agent over a persistent socket connection.- list available schemas

- list tables within a schema

## Architecture- run SQL queries (single-run or interactive REPL)



```Usage

+-------------------------------------------------------------+

| Navigation Bar (logo, ACCP selector, logout)                |1. Install dependencies (preferably in a virtualenv):

+----------------+---------------------------+----------------+

|  Left Panel    |       Middle Panel        |  Right Panel   |```bash

|  (Objects)     |       (SQL Editor)        |  (Charts)      |pip install -r requirements.txt

+----------------+---------------------------+----------------+```

|  Status / Log Console (full width)                          |

+-------------------------------------------------------------+2. Set a DATABASE_URL environment variable (or pass --url):

```

```bash

### Frontend (React + MUI)export DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/dbname"

```

- **ObjectsPanel** -- tree view of schemas and tables; click a table to

  generate a sample query.3. Examples:

- **TabbedSqlEditor** -- tabbed SQL editor with run, export (Excel / JSON /

  XML), and visualize actions.```bash

- **ChartArea** -- automatic chart suggestions (bar, line, pie, scatter) basedpython sqd_cli.py list-schemas

  on query results, plus a custom chart builder.python sqd_cli.py list-tables --schema public

- **StatusConsole** -- timestamped activity log with colour-coded levels.python sqd_cli.py query "SELECT id, name FROM some_table LIMIT 5"

python sqd_cli.py repl

### Backend (FastAPI)```



Key endpoints:Notes & assumptions



| Method | Path | Description |- This tool connects directly to the database via SQLAlchemy. The existing `dbsrc_sqlalchemy_example.py` in the repository shows an alternative socket-based agent approach; this CLI uses direct DB connections for convenience.

|--------|------|-------------|- If your project requires routing queries through a separate agent/service, we can adapt the CLI to call that instead.

| POST | `/connect` | Authenticate and connect to a DbSrc ACCP |

| POST | `/query` | Execute a SQL query |Safety

| GET  | `/access` | List accessible database objects |

| GET  | `/session-info` | Check active session (used for auto-login) |- Use with care on production databases. The REPL will execute any SQL you type.

| POST | `/switch-accp` | Switch to a different ACCP schema |

| POST | `/set-role` | Activate a ROLE with the OTP password |Next steps

| POST | `/disconnect` | Disconnect from the agent |

- Add auth/connection presets, and a small web UI later to turn this into a minimal SaaS front-end.

Interactive API documentation is available at `http://localhost:8000/docs` when
the backend is running.

## Prerequisites

- Python 3.9 or later
- Node.js 18 or later and npm (or Yarn)
- Access to a running DbSrc Agent
- Docker and Docker Compose (optional, for containerised deployment)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/CodeDroidM/senior_project_squid.git
cd senior_project_squid
```

### 2. Backend

```bash
cd server
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the project root (or export the variables in your
shell):

```env
DBSRC_AGENT_HOST=www.compute-mertjiandata.com
DBSRC_AGENT_PORT=9000
DBSRC_CLIENT_HOST=127.0.0.1
```

### 3. Frontend

```bash
cd frontend
npm install
```

Optionally create `frontend/.env`:

```env
REACT_APP_API_URL=http://localhost:8000
```

## Running the Application

### Manual start

Open two terminals:

```bash
# Terminal 1 -- Backend
cd server
source venv/bin/activate
uvicorn squid_backend:app --reload --host 0.0.0.0 --port 8000
```

```bash
# Terminal 2 -- Frontend
cd frontend
npm start
```

The frontend opens at `http://localhost:3000` and the backend API is at
`http://localhost:8000`.

### Docker Compose

```bash
docker compose up --build
```

This starts the backend container on port 8000. To also run the frontend in
Docker, uncomment the `frontend` service block in `docker-compose.yml` and
run the command again.

Useful Docker commands:

```bash
docker compose up -d          # start in background
docker compose logs -f        # follow logs
docker compose down           # stop and remove containers
docker compose up --build     # rebuild after code changes
```

## Usage

1. Open `http://localhost:3000` in a browser.
2. Enter your DbSrc username and password. The backend validates the
   credentials against the agent.
3. Select an ACCP schema. If the ACCP is ROLE-based, an email with a one-time
   password is sent; enter it in the dialog that appears.
4. Use the SQL editor to write and execute queries. Results appear in a table
   below the editor and can be exported or visualised as charts.

## Project Structure

```
senior_project_squid/
  server/                  # FastAPI backend
    squid_backend.py       # Main API application
    chart_detector.py      # Server-side chart suggestion engine
    dbsrc_sqlalchemy.py    # SQLAlchemy helper
    sqd_cli.py             # Standalone CLI tool
    requirements.txt
    Dockerfile
  frontend/                # React frontend
    src/
      App.js               # Main application component
      api.js               # Axios API client
      components/           # UI components
        Login.js
        TabbedSqlEditor.js
        ObjectsPanel.js
        OutputPanel.js
        ResultsTable.js
        ChartArea.js
        charts/             # Chart components and suggestion logic
      services/
        ChartDetector.js    # Client-side chart suggestion fallback
    public/
      squid.svg             # Application logo
  docker-compose.yml
```

## Technology Stack

**Frontend:** React 19, Material UI 7, CodeMirror (SQL mode), Chart.js,
Axios, XLSX, xml2js.

**Backend:** FastAPI, Pydantic, pandas, PyJWT, uvicorn.

## Troubleshooting

- **CORS errors** -- Make sure the backend allows `http://localhost:3000` in
  its CORS origin list.
- **Connection failures** -- Verify the DbSrc Agent host and port are
  reachable and that your credentials are correct.
- **Query errors** -- The agent targets Oracle SQL. Check syntax and confirm
  that the connected schema has access to the referenced tables.
