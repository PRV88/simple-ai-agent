import logging
import uuid
from typing import Any, Dict, Optional
from sqlalchemy import select

from simple_ai.database import get_db
from simple_ai.models.db_models import AgentModel

logger = logging.getLogger("simple_ai.repositories.agent")


class AgentRepository:
    """Repository handling Agent configurations and settings."""

    async def get_or_create_for_user(self, user_id: int, username: str) -> Dict[str, Any]:
        """Fetches the user's agent configuration or initializes a default one."""
        async with get_db() as session:
            stmt = select(AgentModel).where(AgentModel.user_id == user_id)
            result = await session.execute(stmt)
            agent = result.scalar_one_or_none()

            if not agent:
                agent_id = f"agent_{uuid.uuid4().hex[:12]}"
                agent = AgentModel(
                    id=agent_id,
                    user_id=user_id,
                    name=f"{username.capitalize()} AI Assistant",
                    welcome_message=f"Hello! I am {username.capitalize()} AI, your knowledge assistant. How can I assist you today?",
                    system_prompt="You are a professional, helpful enterprise AI assistant. Answer queries grounded strictly in the provided knowledge base context.",
                    model_name="gemini-2.5-flash",
                    max_output_tokens=1024,
                    monthly_token_budget=1000000,
                    temperature=0.7,
                    brand_color="#4f46e5",
                    starter_prompts=[
                        "What is our company security policy?",
                        "What is the database backup standard?",
                        "Summarize key compliance rules",
                    ],
                    mcp_servers=[],
                    is_deployed=True,
                )
                session.add(agent)
                await session.commit()
                await session.refresh(agent)
                logger.info(f"Created default agent '{agent_id}' for user_id={user_id}")

            return agent.to_dict()

    async def get_by_id(self, agent_id: str) -> Optional[Dict[str, Any]]:
        """Fetches agent by primary key ID, with fallback for default/demo placeholders."""
        async with get_db() as session:
            agent = await session.get(AgentModel, agent_id)
            if not agent and agent_id in ("default", "YOUR_AGENT_ID", "default_agent", "demo"):
                stmt = (
                    select(AgentModel)
                    .where(AgentModel.is_deployed == True)
                    .order_by(AgentModel.created_at.asc())
                    .limit(1)
                )
                res = await session.execute(stmt)
                agent = res.scalar_one_or_none()
            return agent.to_dict() if agent else None

    async def update_agent(
        self, agent_id: str, user_id: int, updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Updates agent configuration fields."""
        async with get_db() as session:
            agent = await session.get(AgentModel, agent_id)
            if not agent or agent.user_id != user_id:
                return None

            chosen_name = updates.get("title") or updates.get("name")
            if chosen_name:
                agent.name = chosen_name

            for key, val in updates.items():
                if key in ("title", "name"):
                    continue
                if val is not None and hasattr(agent, key):
                    setattr(agent, key, val)

            await session.commit()
            await session.refresh(agent)
            return agent.to_dict()


agent_repository = AgentRepository()
