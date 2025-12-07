FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run the application with uvicorn (without reload in production)
CMD ["uvicorn", "squid_backend:app", "--host", "0.0.0.0", "--port", "8000"]
