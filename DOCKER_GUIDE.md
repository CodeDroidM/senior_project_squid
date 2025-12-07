# Docker Compose Quick Reference

## Running Services

### Start backend only (current setup)
```bash
docker compose up
```

Or in detached mode:
```bash
docker compose up -d
```

### Start backend and frontend (when ready)
1. Uncomment the frontend service in `docker-compose.yml`
2. Run:
```bash
docker compose up
```

## Useful Commands

### View logs
```bash
# All services
docker compose logs -f

# Backend only
docker compose logs -f backend

# Frontend only (when enabled)
docker compose logs -f frontend
```

### Stop services
```bash
docker compose down
```

### Rebuild after changes
```bash
docker compose up --build
```

### Restart a specific service
```bash
docker compose restart backend
```

### Execute commands in running container
```bash
# Backend shell
docker compose exec backend bash

# Frontend shell (when enabled)
docker compose exec frontend sh
```

## Service URLs

- **Backend API**: http://localhost:5000
- **Frontend**: http://localhost:3000 (when enabled)

## Network

Both services are on the `squid_network` bridge network, allowing them to communicate using service names (e.g., `http://backend:5000` from frontend container).
