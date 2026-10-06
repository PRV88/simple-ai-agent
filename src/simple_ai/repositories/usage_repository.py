import logging
from typing import Any, Dict, List
from sqlalchemy import func, select

from simple_ai.database import get_db
from simple_ai.models.db_models import AgentTokenUsageModel

logger = logging.getLogger("simple_ai.repositories.usage")


class UsageRepository:
    """Repository handling Token consumption and cost logging."""

    async def record_usage(
        self,
        agent_id: str,
        user_id: int,
        session_id: str,
        model_name: str,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        cost_usd: float,
        source: str = "playground",
    ) -> Dict[str, Any]:
        """Logs an individual request's token consumption and computed cost."""
        async with get_db() as session:
            record = AgentTokenUsageModel(
                agent_id=agent_id,
                user_id=user_id,
                session_id=session_id,
                model_name=model_name,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=cost_usd,
                source=source,
            )
            session.add(record)
            await session.commit()
            await session.refresh(record)
            return record.to_dict()

    async def get_summary_for_user(
        self, user_id: int, agent_id: str, monthly_budget: int = 1000000
    ) -> Dict[str, Any]:
        """Calculates aggregated token usage and cost metrics for an admin's agent."""
        async with get_db() as session:
            stmt = select(
                func.coalesce(func.sum(AgentTokenUsageModel.prompt_tokens), 0),
                func.coalesce(func.sum(AgentTokenUsageModel.completion_tokens), 0),
                func.coalesce(func.sum(AgentTokenUsageModel.total_tokens), 0),
                func.coalesce(func.sum(AgentTokenUsageModel.cost_usd), 0.0),
                func.count(AgentTokenUsageModel.id),
            ).where(AgentTokenUsageModel.user_id == user_id)

            res = await session.execute(stmt)
            p_tok, c_tok, tot_tok, tot_cost, count = res.one()

            # Fetch up to 20 most recent records
            recent_stmt = (
                select(AgentTokenUsageModel)
                .where(AgentTokenUsageModel.user_id == user_id)
                .order_by(AgentTokenUsageModel.created_at.desc())
                .limit(20)
            )
            recent_res = await session.execute(recent_stmt)
            recent_records = [r.to_dict() for r in recent_res.scalars().all()]

            budget_used_pct = round((tot_tok / max(monthly_budget, 1)) * 100, 2)

            return {
                "agent_id": agent_id,
                "total_prompt_tokens": int(p_tok),
                "total_completion_tokens": int(c_tok),
                "total_tokens": int(tot_tok),
                "total_cost_usd": round(float(tot_cost), 6),
                "total_requests": int(count),
                "monthly_budget": monthly_budget,
                "budget_used_percentage": budget_used_pct,
                "recent_records": recent_records,
            }


usage_repository = UsageRepository()
