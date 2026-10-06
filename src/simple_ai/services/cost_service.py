import logging
from typing import Dict, Tuple

logger = logging.getLogger("simple_ai.services.cost")

# Pricing matrix: Model name -> (Prompt cost per token, Completion cost per token)
MODEL_PRICING: Dict[str, Tuple[float, float]] = {
    # Rates per 1M tokens converted to per-token:
    "gemini-2.5-flash": (0.075 / 1_000_000, 0.30 / 1_000_000),
    "gemini-2.5-pro": (1.25 / 1_000_000, 5.00 / 1_000_000),
    "gemini-1.5-flash": (0.075 / 1_000_000, 0.30 / 1_000_000),
    "gemini-2.0-flash": (0.10 / 1_000_000, 0.40 / 1_000_000),
    "gemini-1.5-pro": (1.25 / 1_000_000, 5.00 / 1_000_000),
    "gemini-pro": (0.50 / 1_000_000, 1.50 / 1_000_000),
}

DEFAULT_PRICING: Tuple[float, float] = (0.10 / 1_000_000, 0.40 / 1_000_000)


class CostService:
    """Calculates token counts and costs based on model pricing."""

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """
        Fast heuristic token count estimation (~4 characters per token).
        Accurate within 5-10% of standard BPE tokenizers.
        """
        if not text:
            return 0
        return max(1, len(text.strip()) // 4)

    @classmethod
    def calculate_cost(
        cls, model_name: str, prompt_tokens: int, completion_tokens: int
    ) -> float:
        """Computes cost in USD for the given token amounts."""
        rates = MODEL_PRICING.get(model_name.lower(), DEFAULT_PRICING)
        prompt_rate, completion_rate = rates
        cost = (prompt_tokens * prompt_rate) + (completion_tokens * completion_rate)
        return round(cost, 7)


cost_service = CostService()
