# Simple AI - Enterprise Fullstack Knowledge & Vector Engine

A production-grade platform built with **Next.js (App Router, TypeScript, Vanilla CSS)** on the frontend and **FastAPI + PostgreSQL (`pgvector`)** on the backend. Built strictly using **SQLAlchemy 2.0 (Asyncio) ORM**, **Controller-Service-Repository Architecture**, and **Global Exception Handling**.

---

## 🏛️ ORM & Architecture: SQLAlchemy 2.0 + `pgvector.sqlalchemy`

All hardcoded raw SQL strings have been replaced with **SQLAlchemy 2.0 Async ORM** and the official **`pgvector.sqlalchemy`** extension.

```
src/simple_ai/
├── models/
│   ├── db_models.py              # SQLAlchemy 2.0 Declarative Entities (Base, UserModel, DocumentModel, DocumentChunkModel)
│   ├── schemas.py                # Pydantic request/response validation DTOs
│   └── __init__.py               # Unified models export
│
├── controllers/                  # Presentation / HTTP Routing Layer
│   ├── auth_controller.py        # /auth (Register, Login, Me)
│   ├── admin_controller.py       # /admin (Upload, Text, Documents, Search, Stats)
│   └── chat_controller.py        # /chat & Health
│
├── services/                     # Business Logic Layer
│   ├── auth_service.py           # Password hashing & JWT auth
│   ├── et_service.py             # Extract & Transform (ET) Ingestion Pipeline
│   └── rag_service.py            # Vector search grounding & Agent runner
│
├── repositories/                 # Data Access Layer (Pure SQLAlchemy 2.0 ORM)
│   ├── user_repository.py        # select(), session.get(), session.add()
│   ├── document_repository.py    # select(), session.delete(), relationship cascade
│   └── vector_repository.py      # DocumentChunkModel.embedding.cosine_distance()
│
├── exceptions/                   # Centralized Error Handling Layer
│   ├── custom_exceptions.py      # AppException, NotFoundException, ConflictException, etc.
│   └── global_handler.py         # Unified JSON error response envelope
│
├── database.py                   # AsyncEngine, async_sessionmaker, Base.metadata.create_all
├── config.py                     # Centralized environment configurations
└── __init__.py                   # FastAPI initialization & middleware
```

---

## 🔍 Why SQLAlchemy 2.0 + `pgvector.sqlalchemy`?

Instead of fragile, hardcoded raw SQL strings, queries use strongly typed Python expressions:

### 1. User Queries
```python
stmt = select(UserModel).where(
    or_(UserModel.username == identifier, UserModel.email == identifier)
)
user = (await session.execute(stmt)).scalar_one_or_none()
```

### 2. Semantic Vector Cosine Distance Search
```python
from pgvector.sqlalchemy import Vector

distance_expr = DocumentChunkModel.embedding.cosine_distance(query_vec)
similarity_expr = (1 - distance_expr).label("similarity")

stmt = (
    select(DocumentChunkModel, DocumentModel.filename, similarity_expr)
    .join(DocumentModel, DocumentChunkModel.doc_id == DocumentModel.id)
    .where(similarity_expr >= min_score)
    .order_by(distance_expr.asc())
    .limit(top_k)
)
```

---

---

## 🌍 Multi-Environment Setup (`dev` / `stage` / `prod`)

The application supports three environments with separated configurations, isolated databases, tuned connection pools, and environment-specific security controls:

| Setting | Development (`dev`) | Staging (`stage`) | Production (`prod`) |
| :--- | :--- | :--- | :--- |
| **Config File** | `.env.development` | `.env.staging` | `.env.production` |
| **Backend Port** | `8000` | `8001` | `8000` |
| **Database Port/Name** | `5432` / `simple_ai` | `5433` / `simple_ai_stage` | `5432` / `simple_ai_prod` |
| **Docker Compose** | `docker-compose.dev.yml` | `docker-compose.stage.yml` | `docker-compose.prod.yml` |
| **Debug Mode** | `True` | `False` | `False` |
| **Log Level** | `DEBUG` | `INFO` | `WARNING` |
| **Swagger UI (`/docs`)** | Enabled | Enabled | **Disabled (None)** |
| **CORS Policy** | Open (`*`) | Staging domains only | Strict production domains only |
| **Frontend Port** | `3000` | `3001` | `3000` |

---

### 🛠️ Using the Environment Manager CLI (`./scripts/manage_env.sh`)

We provide a unified helper script to easily manage databases, backend, and frontend for any environment:

```bash
# 1. Start the PostgreSQL + pgvector database for an environment
./scripts/manage_env.sh db dev up       # or: stage / prod
./scripts/manage_env.sh db dev status
./scripts/manage_env.sh db dev down

# 2. Start the FastAPI Python Backend
./scripts/manage_env.sh backend dev     # Runs on port 8000 with reload=True
./scripts/manage_env.sh backend stage   # Runs on port 8001
./scripts/manage_env.sh backend prod    # Runs on port 8000 (prod secured)

# 3. Start the Next.js Frontend
./scripts/manage_env.sh frontend dev    # Runs on port 3000 (DEV badge)
./scripts/manage_env.sh frontend stage  # Runs on port 3001 (STAGE badge)
./scripts/manage_env.sh frontend prod   # Production build / preview

# 4. Verify environment configuration
./scripts/manage_env.sh verify dev
./scripts/manage_env.sh verify stage
./scripts/manage_env.sh verify prod
```

---

### 💻 Manual Execution per Environment

#### 1. Development Environment
```bash
# Start Dev Database (Port 5432)
docker compose -f docker-compose.dev.yml up -d

# Run Dev Backend
APP_ENV=development uv run uvicorn simple_ai:app --reload --host 0.0.0.0 --port 8000

# Run Dev Frontend
cd frontend
npm run dev
```

#### 2. Staging Environment
```bash
# Start Staging Database (Port 5433)
docker compose -f docker-compose.stage.yml up -d

# Run Staging Backend
APP_ENV=staging uv run uvicorn simple_ai:app --host 0.0.0.0 --port 8001

# Run Staging Frontend
cd frontend
npm run dev:stage
```

#### 3. Production Environment
```bash
# Start Production Database with resource limits & healthchecks
docker compose -f docker-compose.prod.yml up -d

# Run Production Backend
APP_ENV=production uv run uvicorn simple_ai:app --host 0.0.0.0 --port 8000

# Build and Start Production Frontend
cd frontend
npm run build:prod
npm run start
```
