import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
import uvicorn

from simple_ai.config import settings
from simple_ai.controllers import admin_router, auth_router, chat_router, widget_router
from simple_ai.database import close_db_pool, init_db
from simple_ai.exceptions import register_exception_handlers
from simple_ai.middlewares import RequestTransportSecurityMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables and pgvector extension are created
    await init_db()
    yield
    # Shutdown: cleanly close database pool
    await close_db_pool()


app = FastAPI(
    title=f"Simple AI - Enterprise Knowledge & Vector Engine ({settings.APP_ENV.upper()})",
    description="Production-grade AI Knowledge Ingestion & RAG Platform with Controller-Service-Repository Architecture",
    version="0.3.0",
    lifespan=lifespan,
    docs_url=settings.docs_url,
    redoc_url=settings.redoc_url,
    debug=settings.DEBUG,
)

# 1. Global Exception Handlers
register_exception_handlers(app)

# 2. Request Transport Security (HSTS, TLS/HTTPS Enforcement, Transport Security Headers)
app.add_middleware(RequestTransportSecurityMiddleware)

# 3. CORS Middleware (allows external websites to embed widget)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Register Controllers
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(chat_router)
app.include_router(widget_router)


@app.get("/admin", include_in_schema=False)
@app.get("/admin-dashboard", include_in_schema=False)
def redirect_to_frontend():
    """Redirects to the Next.js frontend application."""
    return RedirectResponse(url=settings.FRONTEND_URL)


def main() -> None:
    uvicorn.run(
        "simple_ai:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.is_development,
        log_level=settings.LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    main()
