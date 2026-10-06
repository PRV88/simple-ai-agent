#!/usr/bin/env bash
# ==============================================================================
# Simple AI - Multi-Environment Management CLI (dev / stage / prod)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

usage() {
    cat << EOF
Usage: $0 <command> <environment> [options]

Commands:
  db <dev|stage|prod> <up|down|status|logs>
      Manage PostgreSQL + pgvector Docker container for the environment.
      - dev   : Port 5432, database 'simple_ai'
      - stage : Port 5433, database 'simple_ai_stage'
      - prod  : Port 5432, database 'simple_ai_prod' (production limits)

  backend <dev|stage|prod>
      Start FastAPI backend with specific environment config.
      - dev   : Port 8000, reload=True, log_level=DEBUG, Swagger UI enabled
      - stage : Port 8001, reload=False, log_level=INFO, Swagger UI enabled
      - prod  : Port 8000, reload=False, log_level=WARNING, Swagger UI disabled

  frontend <dev|stage|prod>
      Start Next.js frontend with specific environment config.
      - dev   : Port 3000 -> Backend at http://localhost:8000
      - stage : Port 3001 -> Backend at http://localhost:8001
      - prod  : Port 3000 -> Backend at production URL

  verify <dev|stage|prod>
      Verify database connection and settings configuration.

Examples:
  $0 db dev up
  $0 backend dev
  $0 frontend dev
  $0 verify dev
EOF
    exit 1
}

CMD="${1:-}"
ENV="${2:-}"
ACTION="${3:-}"

# Normalize environment name
case "${ENV}" in
    dev|development)
        ENV_NAME="development"
        ENV_SHORT="dev"
        COMPOSE_FILE="docker-compose.dev.yml"
        BACKEND_PORT=8000
        FRONTEND_SCRIPT="dev"
        ;;
    stage|staging)
        ENV_NAME="staging"
        ENV_SHORT="stage"
        COMPOSE_FILE="docker-compose.stage.yml"
        BACKEND_PORT=8001
        FRONTEND_SCRIPT="dev:stage"
        ;;
    prod|production)
        ENV_NAME="production"
        ENV_SHORT="prod"
        COMPOSE_FILE="docker-compose.prod.yml"
        BACKEND_PORT=8000
        FRONTEND_SCRIPT="dev:prod"
        ;;
    *)
        echo "[ERROR] Unknown environment: '${ENV}'. Must be 'dev', 'stage', or 'prod'."
        usage
        ;;
esac

cd "${ROOT_DIR}"

case "${CMD}" in
    db)
        case "${ACTION}" in
            up)
                echo "[DB] Starting PostgreSQL + pgvector for [${ENV_NAME}]..."
                docker compose -f "${COMPOSE_FILE}" up -d
                echo "[DB] Waiting for database health check..."
                docker compose -f "${COMPOSE_FILE}" ps
                ;;
            down)
                echo "[DB] Stopping PostgreSQL + pgvector for [${ENV_NAME}]..."
                docker compose -f "${COMPOSE_FILE}" down
                ;;
            status)
                docker compose -f "${COMPOSE_FILE}" ps
                ;;
            logs)
                docker compose -f "${COMPOSE_FILE}" logs -f
                ;;
            *)
                echo "[ERROR] Invalid db action '${ACTION}'. Use: up | down | status | logs"
                exit 1
                ;;
        esac
        ;;

    backend)
        echo "[BACKEND] Starting FastAPI in [${ENV_NAME}] mode on port ${BACKEND_PORT}..."
        export APP_ENV="${ENV_NAME}"
        uv run uvicorn simple_ai:app --host 0.0.0.0 --port "${BACKEND_PORT}" $( [ "${ENV_NAME}" = "development" ] && echo "--reload" )
        ;;

    frontend)
        echo "[FRONTEND] Starting Next.js frontend in [${ENV_NAME}] mode..."
        cd "${ROOT_DIR}/frontend"
        npm run "${FRONTEND_SCRIPT}"
        ;;

    verify)
        echo "[VERIFY] Testing configuration resolution for [${ENV_NAME}]..."
        APP_ENV="${ENV_NAME}" uv run python -c "
from simple_ai.config import settings
print(f'== Environment: {settings.APP_ENV} ==')
print(f'Port:            {settings.PORT}')
print(f'Debug Mode:      {settings.DEBUG}')
print(f'Log Level:       {settings.LOG_LEVEL}')
print(f'Docs URL:        {settings.docs_url} (Swagger)')
print(f'Database URL:    {settings.DATABASE_URL}')
print(f'Vector DB URL:   {settings.VECTOR_DATABASE_URL}')
print(f'Pool Size:       {settings.DB_POOL_SIZE} (Overflow: {settings.DB_MAX_OVERFLOW})')
print(f'CORS Origins:    {settings.cors_origins}')
"
        ;;

    *)
        echo "[ERROR] Unknown command: '${CMD}'"
        usage
        ;;
esac
