#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, } from "@modelcontextprotocol/sdk/types.js";
const MODEL_NAME = "gemma4:26b";
const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
class OllamaBridgeServer {
    server;
    constructor() {
        this.server = new Server({
            name: "ollama-bridge",
            version: "1.0.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
        // Error handling
        this.server.onerror = (error) => console.error("[MCP Error]", error);
        process.on("SIGINT", async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "ask_local_gemma",
                    description: "Send a prompt to the local Gemma 4 (gemma4:26b) model running via Ollama. Useful for extremely complex reasoning, massive text generation, local data extraction or generating code snippets without external API limitations.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            prompt: {
                                type: "string",
                                description: "The prompt to send to the local Gemma 4 model.",
                            },
                            system_prompt: {
                                type: "string",
                                description: "Optional System Prompt. By default will prefix with <|think|> to enable deep reasoning for gemma4 architecture.",
                            }
                        },
                        required: ["prompt"],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name !== "ask_local_gemma") {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
            const args = request.params.arguments;
            const systemStr = args.system_prompt || "<|think|>\nYou are Antigravity's local expert copilot. You are highly intelligent. Provide crisp, technical, perfect answers.";
            try {
                const response = await fetch(OLLAMA_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: MODEL_NAME,
                        prompt: args.prompt,
                        system: systemStr,
                        stream: false,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`Ollama API error! status: ${response.status} - ${response.statusText}`);
                }
                const data = await response.json();
                return {
                    content: [
                        {
                            type: "text",
                            text: data.response,
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to connect or ask Ollama: ${error.message}\nMake sure that Ollama is running and that gemma4:26b is pulled.`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Ollama Bridge MCP server running on stdio");
    }
}
const server = new OllamaBridgeServer();
server.run().catch(console.error);
