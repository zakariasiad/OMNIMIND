import { invoke } from "@tauri-apps/api/core";

export interface McpToolSummary {
  name: string;
  description: string;
  inputSchema: unknown;
}

export interface McpServerInspection {
  endpoint: string;
  serverName: string;
  serverVersion: string;
  protocolVersion: string;
  tools: McpToolSummary[];
}

export async function inspectMcpServer(endpoint: string): Promise<McpServerInspection> {
  const cleaned = endpoint.trim();
  if (!cleaned || cleaned.length > 2048) {
    throw new Error("Enter an MCP endpoint URL under 2,048 characters.");
  }
  return invoke<McpServerInspection>("inspect_mcp_server", { endpoint: cleaned });
}
