from simple_ai.controllers.auth_controller import router as auth_router
from simple_ai.controllers.admin_controller import router as admin_router
from simple_ai.controllers.chat_controller import router as chat_router
from simple_ai.controllers.widget_controller import router as widget_router

__all__ = ["auth_router", "admin_router", "chat_router", "widget_router"]
