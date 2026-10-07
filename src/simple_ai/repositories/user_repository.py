import logging
from typing import Any, Dict, Optional
from sqlalchemy import func, or_, select

from simple_ai.database import get_db
from simple_ai.models.db_models import UserModel

logger = logging.getLogger("simple_ai.repositories.user")


class UserRepository:
    """Repository handling all database operations for users using SQLAlchemy 2.0 ORM."""

    async def find_by_username_or_email(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Retrieves user by username or email using SQLAlchemy select(). Excludes sensitive credentials."""
        async with get_db() as session:
            stmt = select(UserModel).where(
                or_(UserModel.username == identifier, UserModel.email == identifier)
            )
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            return user.to_dict(include_sensitive=False) if user else None

    async def find_credentials_by_identifier(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Retrieves user with password_hash strictly for authentication verification."""
        async with get_db() as session:
            stmt = select(UserModel).where(
                or_(UserModel.username == identifier, UserModel.email == identifier)
            )
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            return user.to_dict(include_sensitive=True) if user else None


    async def find_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves user by primary key ID using SQLAlchemy session.get()."""
        async with get_db() as session:
            user = await session.get(UserModel, user_id)
            return user.to_dict() if user else None

    async def create_user(
        self,
        username: str,
        email: str,
        password_hash: str,
        full_name: Optional[str] = None,
        role: str = "admin",
    ) -> Dict[str, Any]:
        """Creates and persists a new user record using SQLAlchemy ORM entity."""
        async with get_db() as session:
            user = UserModel(
                username=username,
                email=email,
                password_hash=password_hash,
                full_name=full_name,
                role=role,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user.to_dict()

    async def count_users(self) -> int:
        """Counts total registered users using func.count()."""
        async with get_db() as session:
            stmt = select(func.count(UserModel.id))
            result = await session.execute(stmt)
            return result.scalar_one() or 0


user_repository = UserRepository()
