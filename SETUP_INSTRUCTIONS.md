# SQUID Application Setup Instructions

## Overview
SQUID (SQL Query Interface for Data) is a 3-panel responsive web application built with React (MUI) frontend and FastAPI backend for executing SQL queries through the DbSrc Agent.

## Architecture

```
+-------------------------------------------------------------+
| SQUID LOGO + Navigation Bar (logout, settings)              |
+----------------+---------------------------+----------------+
|  Left Panel    |       Middle Panel        |   Right Panel  |
| (Objects)      |       (SQL Editor)        |   (Chart Area) |
+----------------+---------------------------+----------------+
|  Status/Log Console (bottom, full width)                   |
+-------------------------------------------------------------+
```

## Components

### Frontend (React + MUI)
- **ObjectsPanel**: Displays accessible database objects/tables in accordion view
- **SqlEditor**: SQL query editor with run, export (Excel/JSON/XML), and visualize features
- **ChartArea**: Data visualization with Bar, Line, and Pie charts (Chart.js)
- **StatusConsole**: Activity log console showing all operations
- **App.js**: Main application with responsive 3-column grid layout

### Backend (FastAPI)
- **Endpoints**:
  - `POST /connect` - Connect to DbSrc Agent and authenticate
  - `GET /access` - Get accessible database objects
  - `POST /query` - Execute SQL queries
  - `POST /disconnect` - Disconnect from agent

## Prerequisites

- Node.js and Yarn
- Python 3.9+
- Docker and Docker Compose (optional)
- Access to DbSrc Agent

## Installation

### Backend Setup

1. Navigate to the server directory:
```bash
cd /home/ivmarche/senior_project_squid/server
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables (create `.env` file in project root):
```env
DBSRC_AGENT_HOST=www.compute-mertjiandata.com
DBSRC_AGENT_PORT=9000
DBSRC_USERNAME=your_username
DBSRC_USER_PASSWORD=your_password
DBSRC_ACCP_ID=your_accp_id
DBSRC_CLIENT_HOST=127.0.0.1
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd /home/ivmarche/senior_project_squid/frontend
```

2. Install dependencies:
```bash
yarn install
```

3. Create `.env` file in frontend directory:
```env
REACT_APP_API_URL=http://localhost:8000
```

## Running the Application

### Option 1: Manual Start

#### Start Backend:
```bash
cd /home/ivmarche/senior_project_squid/server
uvicorn squid_backend:app --reload --host 0.0.0.0 --port 8000
```

#### Start Frontend:
```bash
cd /home/ivmarche/senior_project_squid/frontend
yarn start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Docker Compose (if configured)

```bash
cd /home/ivmarche/senior_project_squid
docker-compose up
```

## Features

### 🗂️ Left Panel: Accessible Objects
- Tree view of schemas and tables
- Click any table to auto-generate sample query
- Real-time loading of accessible database objects

### 🧾 Middle Panel: SQL Query Editor
- **Run Query** (▶): Execute SQL statements
- **Export**: Download results as Excel, JSON, or XML
- **Visualize** (📈): Send data to chart panel
- Results displayed in sortable data grid
- Syntax highlighting and multi-line support

### 📊 Right Panel: Chart Area
- **Bar Chart**: Compare categorical data
- **Line Chart**: Show trends over time
- **Pie Chart**: Display proportions
- Auto-detection of numeric vs. label columns
- Toggle between chart types

### 📋 Status Console
- Real-time activity logging
- Color-coded log levels (info, success, warning, error)
- Timestamps for all operations
- Clear logs functionality

## API Usage

### Connect to Agent
```bash
curl -X POST http://localhost:8000/connect
```

### Get Accessible Objects
```bash
curl http://localhost:8000/access
```

### Execute Query
```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT * FROM schema.table FETCH FIRST 10 ROWS ONLY"}'
```

### Disconnect
```bash
curl -X POST http://localhost:8000/disconnect
```

## Technology Stack

### Frontend
- React 19
- Material-UI (MUI) 7
- Chart.js + react-chartjs-2
- Axios for API calls
- XLSX for Excel export
- xml2js for XML export

### Backend
- FastAPI
- Pydantic for data validation
- Custom DbSrc connector
- CORS middleware enabled

## Troubleshooting

### CORS Issues
Ensure backend CORS settings allow frontend origin:
```python
allow_origins=["http://localhost:3000"]
```

### Connection Issues
1. Verify DbSrc Agent is accessible
2. Check credentials in environment variables
3. Review backend logs for connection errors

### Query Failures
1. Check SQL syntax for Oracle Database
2. Verify user has access to schema/table
3. Review status console for detailed error messages

## Next Steps

- Add tab support for multiple query sessions
- Implement user authentication
- Add query history and favorites
- Support for saved queries
- Advanced chart customization options

## Development

All MUI packages and dependencies are already installed. The application is ready to run.

### File Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── ObjectsPanel.js
│   │   ├── SqlEditor.js
│   │   ├── ChartArea.js
│   │   └── StatusConsole.js
│   ├── api.js
│   └── App.js
server/
├── squid_backend.py
├── dbsrc_sqlalchemy.py
└── requirements.txt
```

## Support

For issues or questions, refer to the project documentation or contact the development team.
