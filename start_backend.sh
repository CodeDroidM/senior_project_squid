#!/bin/bash

# SQUID Backend Startup Script
# This script starts the FastAPI backend server

echo "🚀 Starting SQUID Backend Server..."
echo "=================================="

# Navigate to the server directory
cd "$(dirname "$0")/server"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv venv
    source venv/bin/activate
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo "✅ Virtual environment activated"
echo "📍 Starting FastAPI server on http://localhost:8000"
echo "📖 API documentation available at http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================="

# Start the FastAPI server
uvicorn squid_backend:app --reload --host 0.0.0.0 --port 8000
