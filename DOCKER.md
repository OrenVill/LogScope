# Running LogScope with Docker

LogScope can easily run in a Docker container for a consistent, dependency-free experience.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

From the repository root:

```bash
docker-compose up
```

The service will be available at **http://localhost:3000** with logs persisted in the `logscope_logs` volume.

### Stop the service

```bash
docker-compose down
```

## Configuration

You can customize environment variables directly:

```bash
PORT=3001 LOG_MAX_TOTAL=1000 CLEANUP_INTERVAL_MS=5000 docker-compose up
```

Available variables:

| Variable | Default | Description |
|----------|---------|---|
| `PORT` | `3000` | Exposed port for the service |
| `CLEANUP_INTERVAL_MS` | `10000` | How often cleanup checks run (ms) |
| `LOG_MAX_TOTAL` | `500` | Max logs before cleanup triggers |
| `LOG_MAX_AGE_MS` | `3600000` | Delete logs older than this (ms) |
| `LOG_DELETE_COUNT` | `100` | Logs to delete per cleanup cycle |

## Building Manually

To build the image separately:

```bash
docker build -t logscope:latest .
```

Then run it:

```bash
docker run -p 3000:3000 -v logscope_logs:/app/logs logscope:latest
```

## Volumes

Logs are persisted in a Docker volume named `logscope_logs`. To see what's inside:

```bash
docker volume inspect logscope_logs
```

To remove all data (including logs):

```bash
docker-compose down -v
```

## Health Check

The container includes a health check that verifies the service is running:

```bash
docker-compose ps  # Shows health status
```

## Development with Docker

For development with hot-reload, use the traditional method:

```bash
npm install
npm run dev  # From server/ and web/ directories in separate terminals
```

Docker is best for production-like testing and distribution.

## Troubleshooting

### Port already in use
Change the port:
```bash
PORT=3001 docker-compose up
```

### Rebuild the image
Force a clean build:
```bash
docker-compose up --build
```

### View logs
```bash
docker-compose logs -f logscope
```

### Remove everything
```bash
docker-compose down -v --rmi all
```
