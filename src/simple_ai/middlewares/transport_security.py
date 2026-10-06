import logging
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, RedirectResponse
from starlette.types import ASGIApp

from simple_ai.config import settings

logger = logging.getLogger("simple_ai.middlewares.transport_security")


class RequestTransportSecurityMiddleware(BaseHTTPMiddleware):
    """
    Enterprise Request Transport Security (HSTS & TLS Enforcement) Middleware.

    Features:
    1. HTTP Strict Transport Security (RFC 6797):
       Enforces client-side HTTPS caching via 'Strict-Transport-Security' header.
    2. Optional Transport Layer Security (TLS/HTTPS) Redirect:
       Automatically upgrades plaintext HTTP requests to secure HTTPS when ENFORCE_HTTPS is enabled.
    3. Defensive Transport Headers:
       - X-Content-Type-Options: nosniff
       - X-XSS-Protection: 1; mode=block
       - Referrer-Policy: strict-origin-when-cross-origin
       - Permissions-Policy: Restricts unneeded device hardware APIs
       - Adaptive X-Frame-Options: Protects admin endpoints while permitting widget embedding.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 1. Check for HTTPS upgrade requirement
        if settings.ENFORCE_HTTPS:
            # Check scheme and proxy headers (e.g., from Cloudflare, AWS ALB, NGINX, GCP)
            forwarded_proto = request.headers.get("x-forwarded-proto", "").lower()
            scheme = forwarded_proto or request.url.scheme.lower()

            if scheme == "http":
                # Upgrade connection to HTTPS with 301 Permanent Redirect
                secure_url = request.url.replace(scheme="https")
                logger.info(f"Upgrading insecure HTTP request to HTTPS: {secure_url}")
                return RedirectResponse(
                    url=str(secure_url),
                    status_code=301,
                    headers={
                        "Strict-Transport-Security": settings.hsts_header_value,
                        "X-Transport-Security": "HTTPS-Upgraded",
                    },
                )

        # 2. Process request through inner pipeline
        response = await call_next(request)

        # 3. Apply HTTP Strict Transport Security (HSTS)
        if settings.HSTS_ENABLED:
            response.headers["Strict-Transport-Security"] = settings.hsts_header_value

        # 4. Standard Transport Security & MIME Guard Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = settings.SECURE_REFERRER_POLICY
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )
        response.headers["X-Transport-Security"] = "HSTS-Enforced; TLS-Ready"

        # 5. Adaptive Frame Framing: Allow widget routes, restrict admin routes
        path = request.url.path
        if not path.startswith("/widget") and not path.startswith("/static"):
            if "x-frame-options" not in response.headers:
                response.headers["X-Frame-Options"] = "SAMEORIGIN"

        return response
