import asyncio
import sys

from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ResultMessage, SystemMessage, query

question = sys.argv[1] if len(sys.argv) > 1 else "What does src/orders.js export? Answer in two sentences."


async def main() -> int:
    code = 0
    async for message in query(
        prompt=question,
        options=ClaudeAgentOptions(
            model="haiku",
            allowed_tools=["Read", "Glob", "Grep"],
            max_turns=6,
            max_budget_usd=0.25,
        ),
    ):
        if isinstance(message, SystemMessage) and message.subtype == "init":
            data = message.data
            print(f"claude code {data.get('claude_code_version')}, model {data.get('model')}, mcp servers {len(data.get('mcp_servers', []))}")
        elif isinstance(message, AssistantMessage):
            for block in message.content:
                if hasattr(block, "text"):
                    print(block.text)
                elif hasattr(block, "name"):
                    print(f"[tool] {block.name}")
        elif isinstance(message, ResultMessage):
            print(f"{message.subtype}: {message.num_turns} turns, ${message.total_cost_usd:.4f}")
            code = 1 if message.is_error else 0
    return code


sys.exit(asyncio.run(main()))
