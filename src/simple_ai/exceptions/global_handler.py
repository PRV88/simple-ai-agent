import logging
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from simple_ai.exceptions.custom_exceptions import AppException

logger = logging.getLogger("simple_ai.exceptions")


def register_exception_handlers(app: FastAPI) -> None:
    """
    Registers centralized global exception handlers on the FastAPI application.
    Enforces unified JSON response envelopes across all error categories.
    """

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.warning(
            f"Domain Exception [{exc.error_code}]: {exc.message} on {request.method} {request.url.path}"
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "detail": exc.message,
                "error": {
                    "code": exc.error_code,
                    "message": exc.message,
                    "details": exc.details,
                },
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        logger.warning(
            f"HTTP Exception [{exc.status_code}]: {exc.detail} on {request.method} {request.url.path}"
        )
        error_code = "HTTP_ERROR"
        if exc.status_code == 401:
            error_code = "UNAUTHORIZED"
        elif exc.status_code == 403:
            error_code = "FORBIDDEN"
        elif exc.status_code == 404:
            error_code = "NOT_FOUND"
        elif exc.status_code == 400:
            error_code = "BAD_REQUEST"

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "detail": exc.detail,
                "error": {
                    "code": error_code,
                    "message": str(exc.detail),
                    "details": None,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        formatted_errors = []
        for err in exc.errors():
            loc = " -> ".join([str(x) for x in err.get("loc", [])])
            msg = err.get("msg", "Invalid input")
            formatted_errors.append({"field": loc, "message": msg, "type": err.get("type")})

        logger.warning(
            f"Validation Error on {request.method} {request.url.path}: {formatted_errors}"
        )
        error_msg = formatted_errors[0]["message"] if formatted_errors else "Validation error"
        return JSONResponse(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            content={
                "success": False,
                "detail": error_msg,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": error_msg,
                    "details": formatted_errors,
                },
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(
            f"Unhandled Server Error on {request.method} {request.url.path}: {str(exc)}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "detail": "Internal server error. Please try again later.",
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred while processing your request.",
                    "details": str(exc) if app.debug else None,
                },
            },
        )
