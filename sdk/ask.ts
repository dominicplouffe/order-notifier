import { query } from "@anthropic-ai/claude-agent-sdk";

const question = process.argv[2] ?? "What does src/orders.js export? Answer in two sentences.";

for await (const message of query({
  prompt: question,
  options: {
    model: "haiku",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 6,
    maxBudgetUsd: 0.25,
  },
})) {
  if (message.type === "system" && message.subtype === "init") {
    console.log(`claude code ${message.claude_code_version}, model ${message.model}, mcp servers ${message.mcp_servers.length}`);
  } else if (message.type === "assistant") {
    for (const block of message.message.content) {
      if ("text" in block) console.log(block.text);
      else if ("name" in block) console.log(`[tool] ${block.name}`);
    }
  } else if (message.type === "result") {
    console.log(`${message.subtype}: ${message.num_turns} turns, $${message.total_cost_usd.toFixed(4)}`);
    process.exitCode = message.is_error ? 1 : 0;
  }
}
