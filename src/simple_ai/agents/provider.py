# Configure Gemini as the LLM Provider
from simple_ai.config import MODEL,BASE_URL,API_KEY
from agents import OpenAIChatCompletionsModel
from openai import AsyncOpenAI
from agents import set_default_openai_api
set_default_openai_api("chat_completions")

gemini_client = AsyncOpenAI(
    api_key=API_KEY,
    base_url=BASE_URL,
)

model = OpenAIChatCompletionsModel(
    model=MODEL,
    openai_client=gemini_client
)


DEPRECATED_MODELS = {"gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", "gemini-1.0-pro"}


def get_agent_model(model_name: str | None = None) -> OpenAIChatCompletionsModel:
    """Returns an OpenAIChatCompletionsModel configured for the requested model."""
    target_model = model_name or MODEL
    if target_model in DEPRECATED_MODELS:
        target_model = MODEL
    return OpenAIChatCompletionsModel(
        model=target_model,
        openai_client=gemini_client,
    )

