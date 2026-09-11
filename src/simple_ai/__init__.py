from dotenv import load_dotenv
load_dotenv() 
from fastapi import FastAPI;
import uvicorn
import asyncio 
import os 
from pydantic import BaseModel
from openai import AsyncOpenAI
from agents import Agent, Runner, Trace, OpenAIChatCompletionsModel ,set_default_openai_api

set_default_openai_api("chat_completions")
app = FastAPI()

# Configure Gemini as the LLM Provider

gemini_client = AsyncOpenAI(
    api_key=os.getenv("GEMINI_API_KEY"),
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

model = OpenAIChatCompletionsModel(
    model="gemini-2.5-flash",
    openai_client=gemini_client
)

# Define the agent 
agent = Agent(
    name="simleAgent",
    instructions="You are stock market asistant, Anwer question and unstand risk and question conxtext and revert insigtful",
    model=model
)




async def run_agent():
    print("Simple Stock AI Agent (type 'quite' to exit)\n")

    while(True):
        user_input = input("\n You: ")

        if(user_input.strip().lower() in ("quite", "exit")):
            print("Thank's for using stock agent")
            break
        
        result = await Runner.run(agent, user_input)
        print(f"Agent: {result.final_output}\n")


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def home():
    return {
        "message": "Hello World"
    }

@app.post("/chat")
async def chat(request:ChatRequest):
    result = await Runner.run(agent, request.message);  
    return {"message": result.final_output}
    

def main() -> None:
 
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    print("Hello from simple-ai!")
