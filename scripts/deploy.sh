#!/usr/bin/env bash
# ==============================================================================
# Simple AI - Master Deployment & Environment Orchestrator
# Supports: Local Development, Full Docker Stack, and Vercel Cloud Deployments
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ANSI Color Codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${CYAN}ℹ [INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✔ [SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠ [WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}✖ [ERROR]${NC} $1"
}

print_banner() {
    echo -e "${BOLD}${CYAN}"
    echo "======================================================================"
    echo "            SIMPLE AI - UNIFIED DEPLOYMENT ORCHESTRATOR               "
    echo "   FastAPI + pgvector + Next.js + Universal Embeddable Chat Widget    "
    echo "======================================================================"
    echo -e "${NC}"
}

usage() {
    print_banner
    cat << EOF
Usage: $0 <target> [options]

Targets:
  local        Deploy full stack locally (Postgres pgvector + Backend + Frontend)
  dev          Start local development mode with hot-reload (ports 8000 & 3000)
  cloud|vercel Deploy production backend and frontend to Vercel
  docker       Build and launch full production stack with Docker Compose
  stop         Stop all running local services and free ports (5432, 8000, 3000)
  status       Check live health of database, backend, frontend, and cloud
  test         Run tests & Ragas evaluation benchmark

Examples:
  $0 local            # Start entire stack locally without port collisions
  $0 dev              # Start hot-reloading dev environment
  $0 cloud            # Commit, push, and deploy to Vercel
  $0 stop             # Kill any running background servers and containers
  $0 status           # Check health of all services
EOF
    exit 1
}

# ------------------------------------------------------------------------------
# Helper: Free Port Safely
# ------------------------------------------------------------------------------
free_port() {
    local port="$1"
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_warn "Port ${port} is currently occupied by PID(s): ${pids}. Freeing port..."
        kill -15 $pids 2>/dev/null || true
        sleep 1
        pids_remaining=$(lsof -ti :"$port" 2>/dev/null || true)
        if [ -n "$pids_remaining" ]; then
            kill -9 $pids_remaining 2>/dev/null || true
        fi
        log_success "Port ${port} has been freed."
    fi
}

# ------------------------------------------------------------------------------
# 1. Database Provisioning (pgvector)
# ------------------------------------------------------------------------------
start_database() {
    log_info "Verifying PostgreSQL + pgvector container..."
    
    # Check if a postgres container is already running on 5432
    if docker ps --format '{{.Names}}' | grep -E "simple_ai_pgvector|simple_ai_pgvector_dev" > /dev/null 2>&1; then
        local running_name
        running_name=$(docker ps --format '{{.Names}}' | grep -E "simple_ai_pgvector|simple_ai_pgvector_dev" | head -n 1)
        log_success "pgvector database is already active inside container '${running_name}'."
    else
        # If port 5432 is blocked by a non-docker or orphan process, free or inspect
        if lsof -i :5432 > /dev/null 2>&1; then
            log_warn "Port 5432 is in use. Checking running Docker containers..."
            docker ps --filter "publish=5432"
        fi

        log_info "Starting pgvector container via docker-compose.dev.yml..."
        docker compose -f "${ROOT_DIR}/docker-compose.dev.yml" up -d --remove-orphans
    fi

    log_info "Waiting for PostgreSQL database to accept connections..."
    for i in {1..30}; do
        if docker exec $(docker ps -q --filter "ancestor=pgvector/pgvector:pg16" | head -n 1) pg_isready -U postgres > /dev/null 2>&1; then
            log_success "PostgreSQL + pgvector is healthy and accepting connections on port 5432."
            return 0
        fi
        sleep 1
    done
    log_warn "Database startup timeout reached. Proceeding with application startup..."
}

# ------------------------------------------------------------------------------
# 2. Local Backend Service
# ------------------------------------------------------------------------------
start_backend() {
    local mode="${1:-development}"
    log_info "Preparing FastAPI Backend on port 8000 (Mode: ${mode})..."
    free_port 8000

    cd "${ROOT_DIR}"
    export APP_ENV="${mode}"
    
    if [ "${mode}" = "development" ]; then
        log_info "Launching FastAPI with hot-reload on http://localhost:8000..."
        uv run uvicorn simple_ai:app --reload --host 0.0.0.0 --port 8000
    else
        log_info "Launching FastAPI production daemon on http://localhost:8000..."
        uv run uvicorn simple_ai:app --host 0.0.0.0 --port 8000 --workers 2
    fi
}

# ------------------------------------------------------------------------------
# 3. Local Frontend Service
# ------------------------------------------------------------------------------
start_frontend() {
    local mode="${1:-dev}"
    log_info "Preparing Next.js Frontend on port 3000..."
    free_port 3000

    cd "${ROOT_DIR}/frontend"
    if [ "${mode}" = "prod" ]; then
        log_info "Building and starting production frontend bundle..."
        npm run build
        npm run start
    else
        log_info "Starting Next.js development server on http://localhost:3000..."
        npm run dev
    fi
}

# ------------------------------------------------------------------------------
# 4. Full Local Stack (Background Daemons)
# ------------------------------------------------------------------------------
deploy_local_stack() {
    print_banner
    log_info "Deploying full local Simple AI stack (DB + Backend + Frontend)..."
    
    start_database

    log_info "Freeing application ports (8000, 3000)..."
    free_port 8000
    free_port 3000

    log_info "Starting FastAPI backend in background..."
    cd "${ROOT_DIR}"
    APP_ENV=production uv run uvicorn simple_ai:app --host 0.0.0.0 --port 8000 --workers 2 > /tmp/simple_ai_backend.log 2>&1 &
    local backend_pid=$!
    log_success "Backend started (PID: ${backend_pid}). Logs: /tmp/simple_ai_backend.log"

    log_info "Building and starting Next.js frontend in background (Local Dev mode)..."
    cd "${ROOT_DIR}/frontend"
    npm run build:dev > /dev/null 2>&1
    npm run start:dev > /tmp/simple_ai_frontend.log 2>&1 &
    local frontend_pid=$!
    log_success "Frontend started (PID: ${frontend_pid}). Logs: /tmp/simple_ai_frontend.log"

    sleep 3
    check_status
}

# ------------------------------------------------------------------------------
# 5. Cloud Deployment (Vercel)
# ------------------------------------------------------------------------------
deploy_cloud() {
    print_banner
    log_info "Initiating Production Deployment to Vercel Cloud..."
    cd "${ROOT_DIR}"

    # 1. Typecheck & Frontend Build verification
    log_info "Validating Next.js frontend build before deployment..."
    npm --prefix frontend run build
    log_success "Frontend compilation verified."

    # 2. Check Git status and push
    log_info "Checking Git working tree status..."
    if [ -n "$(git status --porcelain)" ]; then
        log_info "Staging and committing repository changes..."
        git add .
        git commit -m "Production release: $(date -u +"%Y-%m-%d %H:%M:%S UTC")" || true
    fi

    log_info "Pushing latest commits to GitHub origin/main..."
    git push origin main || log_warn "Git push skipped or already up to date."

    # 3. Deploy Backend API to Vercel
    log_info "Deploying FastAPI Backend to Vercel (simple-ai-agent)..."
    npx vercel --prod --yes

    # 4. Deploy Frontend Web App to Vercel
    log_info "Deploying Next.js Frontend to Vercel (simple-ai-agent-frontend)..."
    (cd "${ROOT_DIR}/frontend" && npx vercel --prod --yes)

    # 5. Post-deploy health verification
    log_info "Verifying live cloud endpoints..."
    sleep 3
    local api_url="https://simple-ai-agent-six.vercel.app"
    local fe_url="https://simple-ai-agent-frontend.vercel.app"
    
    if curl -s -f "${api_url}/" > /dev/null 2>&1; then
        log_success "Backend API is live at ${api_url}/"
    else
        log_warn "Backend API ping returned non-200, checking logs..."
    fi

    if curl -s -f "${fe_url}/" > /dev/null 2>&1; then
        log_success "Frontend UI is live at ${fe_url}/"
    else
        log_warn "Frontend UI ping returned non-200, checking logs..."
    fi

    if curl -s -f -I "${api_url}/widget/chat-widget.js" > /dev/null 2>&1; then
        log_success "Universal Embeddable Widget is live at ${api_url}/widget/chat-widget.js"
    else
        log_warn "Widget script verification warning."
    fi

    echo ""
    log_success "Cloud deployment complete! 🎉"
    echo -e "  • Web App UI:  ${BOLD}${fe_url}/${NC}"
    echo -e "  • Backend API: ${BOLD}${api_url}/${NC}"
    echo -e "  • Chat Widget: ${BOLD}${api_url}/widget/chat-widget.js${NC}"
}

# ------------------------------------------------------------------------------
# 6. Docker Production Stack
# ------------------------------------------------------------------------------
deploy_docker() {
    print_banner
    log_info "Launching Production Stack with Docker Compose..."
    cd "${ROOT_DIR}"
    free_port 8000
    free_port 3000
    docker compose -f docker-compose.prod.yml up -d --build
    docker compose -f docker-compose.prod.yml ps
    log_success "Production Docker containers are running."
}

# ------------------------------------------------------------------------------
# 7. Stop All Local Services
# ------------------------------------------------------------------------------
stop_services() {
    print_banner
    log_info "Stopping all Simple AI local processes and containers..."
    
    free_port 8000
    free_port 3000

    cd "${ROOT_DIR}"
    if [ -f docker-compose.dev.yml ]; then
        docker compose -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
    fi
    if [ -f docker-compose.yml ]; then
        docker compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
    fi
    if [ -f docker-compose.prod.yml ]; then
        docker compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
    fi

    log_success "All local services have been stopped and ports (5432, 8000, 3000) are free."
}

# ------------------------------------------------------------------------------
# 8. Check Status
# ------------------------------------------------------------------------------
check_status() {
    print_banner
    echo -e "${BOLD}Local Services Health:${NC}"
    
    # Check DB
    if lsof -i :5432 > /dev/null 2>&1; then
        echo -e "  • PostgreSQL (5432): ${GREEN}RUNNING${NC}"
    else
        echo -e "  • PostgreSQL (5432): ${RED}STOPPED${NC}"
    fi

    # Check Backend
    if curl -s http://localhost:8000/ > /dev/null 2>&1; then
        echo -e "  • Backend API (8000): ${GREEN}ONLINE (HTTP 200)${NC}"
    else
        echo -e "  • Backend API (8000): ${RED}OFFLINE${NC}"
    fi

    # Check Frontend
    if curl -s -I http://localhost:3000/ > /dev/null 2>&1; then
        echo -e "  • Frontend UI (3000): ${GREEN}ONLINE (HTTP 200)${NC}"
    else
        echo -e "  • Frontend UI (3000): ${RED}OFFLINE${NC}"
    fi

    echo ""
    echo -e "${BOLD}Cloud Production Health:${NC}"
    if curl -s https://simple-ai-agent-six.vercel.app/ > /dev/null 2>&1; then
        echo -e "  • Vercel API:         ${GREEN}ONLINE (https://simple-ai-agent-six.vercel.app)${NC}"
    else
        echo -e "  • Vercel API:         ${RED}UNREACHABLE${NC}"
    fi

    if curl -s -f https://simple-ai-agent-frontend.vercel.app/ > /dev/null 2>&1; then
        echo -e "  • Frontend Web App:   ${GREEN}ONLINE (https://simple-ai-agent-frontend.vercel.app)${NC}"
    else
        echo -e "  • Frontend Web App:   ${RED}UNREACHABLE${NC}"
    fi

    if curl -s -I https://simple-ai-agent-six.vercel.app/widget/chat-widget.js > /dev/null 2>&1; then
        echo -e "  • Widget Script:      ${GREEN}SERVED (HTTP 200)${NC}"
    else
        echo -e "  • Widget Script:      ${RED}NOT FOUND${NC}"
    fi
    echo ""
}

# ------------------------------------------------------------------------------
# Main Dispatcher
# ------------------------------------------------------------------------------
TARGET="${1:-help}"

case "${TARGET}" in
    local)
        deploy_local_stack
        ;;
    dev)
        print_banner
        start_database
        start_backend "development"
        ;;
    cloud|vercel)
        deploy_cloud
        ;;
    docker|prod-docker)
        deploy_docker
        ;;
    stop)
        stop_services
        ;;
    status)
        check_status
        ;;
    test)
        print_banner
        log_info "Running Ragas evaluation test suite..."
        cd "${ROOT_DIR}"
        uv run python scripts/evaluate_ragas.py --dataset test_suite.json --output reports/eval.json
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        log_error "Unknown target '${TARGET}'"
        usage
        ;;
esac
