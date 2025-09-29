#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { createServer } from "http";

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const MODE = process.env.MODE || "stdio"; // "stdio" or "http"

if (!HUBSPOT_API_KEY) {
  console.error("HUBSPOT_API_KEY environment variable is required");
  process.exit(1);
}

const HUBSPOT_API_BASE = "https://api.hubapi.com";

async function makeHubSpotRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${HUBSPOT_API_BASE}${endpoint}`;
  const headers = {
    "Authorization": `Bearer ${HUBSPOT_API_KEY}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HubSpot API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

const server = new Server(
  {
    name: "hubspot-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_contacts",
        description: "Search for contacts in HubSpot by email, name, or other properties",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (email, name, etc.)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default: 10)",
              default: 10,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_contact",
        description: "Get a contact by ID",
        inputSchema: {
          type: "object",
          properties: {
            contactId: {
              type: "string",
              description: "The HubSpot contact ID",
            },
          },
          required: ["contactId"],
        },
      },
      {
        name: "create_contact",
        description: "Create a new contact in HubSpot",
        inputSchema: {
          type: "object",
          properties: {
            email: {
              type: "string",
              description: "Contact email address",
            },
            firstname: {
              type: "string",
              description: "First name",
            },
            lastname: {
              type: "string",
              description: "Last name",
            },
            phone: {
              type: "string",
              description: "Phone number",
            },
            company: {
              type: "string",
              description: "Company name",
            },
          },
          required: ["email"],
        },
      },
      {
        name: "update_contact",
        description: "Update an existing contact",
        inputSchema: {
          type: "object",
          properties: {
            contactId: {
              type: "string",
              description: "The HubSpot contact ID",
            },
            properties: {
              type: "object",
              description: "Properties to update (e.g., {firstname: 'John', lastname: 'Doe'})",
            },
          },
          required: ["contactId", "properties"],
        },
      },
      {
        name: "list_deals",
        description: "List deals in HubSpot",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of deals to return (default: 10)",
              default: 10,
            },
          },
        },
      },
      {
        name: "create_deal",
        description: "Create a new deal in HubSpot",
        inputSchema: {
          type: "object",
          properties: {
            dealname: {
              type: "string",
              description: "Name of the deal",
            },
            amount: {
              type: "string",
              description: "Deal amount",
            },
            dealstage: {
              type: "string",
              description: "Deal stage ID",
            },
            pipeline: {
              type: "string",
              description: "Pipeline ID",
            },
          },
          required: ["dealname"],
        },
      },
      {
        name: "list_companies",
        description: "List companies in HubSpot",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of companies to return (default: 10)",
              default: 10,
            },
          },
        },
      },
      {
        name: "create_company",
        description: "Create a new company in HubSpot",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Company name",
            },
            domain: {
              type: "string",
              description: "Company domain",
            },
            city: {
              type: "string",
              description: "City",
            },
            industry: {
              type: "string",
              description: "Industry",
            },
          },
          required: ["name"],
        },
      },
    ],
  };
});

async function handleToolCall(name: string, args: any) {
  switch (name) {
    case "search_contacts": {
      const { query, limit = 10 } = args as { query: string; limit?: number };
      return await makeHubSpotRequest(
        `/crm/v3/objects/contacts/search`,
        {
          method: "POST",
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: "email",
                    operator: "CONTAINS_TOKEN",
                    value: query,
                  },
                ],
              },
            ],
            limit,
          }),
        }
      );
    }

    case "get_contact": {
      const { contactId } = args as { contactId: string };
      return await makeHubSpotRequest(`/crm/v3/objects/contacts/${contactId}`);
    }

    case "create_contact": {
      const properties = args as Record<string, string>;
      return await makeHubSpotRequest(`/crm/v3/objects/contacts`, {
        method: "POST",
        body: JSON.stringify({ properties }),
      });
    }

    case "update_contact": {
      const { contactId, properties } = args as {
        contactId: string;
        properties: Record<string, string>;
      };
      return await makeHubSpotRequest(
        `/crm/v3/objects/contacts/${contactId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ properties }),
        }
      );
    }

    case "list_deals": {
      const { limit = 10 } = args as { limit?: number };
      return await makeHubSpotRequest(`/crm/v3/objects/deals?limit=${limit}`);
    }

    case "create_deal": {
      const properties = args as Record<string, string>;
      return await makeHubSpotRequest(`/crm/v3/objects/deals`, {
        method: "POST",
        body: JSON.stringify({ properties }),
      });
    }

    case "list_companies": {
      const { limit = 10 } = args as { limit?: number };
      return await makeHubSpotRequest(
        `/crm/v3/objects/companies?limit=${limit}`
      );
    }

    case "create_company": {
      const properties = args as Record<string, string>;
      return await makeHubSpotRequest(`/crm/v3/objects/companies`, {
        method: "POST",
        body: JSON.stringify({ properties }),
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    const data = await handleToolCall(name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// HTTP Server with SSE streaming
function startHttpServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // List available tools
  app.get("/tools", async (req, res) => {
    try {
      const tools = await server.request(
        { method: "tools/list" },
        ListToolsRequestSchema
      );
      res.json(tools);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Execute tool with streaming response
  app.post("/tools/:toolName/execute", async (req, res) => {
    const { toolName } = req.params;
    const args = req.body;

    // Set headers for SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      sendEvent("start", { tool: toolName, args });

      const result = await handleToolCall(toolName, args);
      
      // Stream the result in chunks if it's large
      const resultStr = JSON.stringify(result, null, 2);
      const chunkSize = 1000;
      
      for (let i = 0; i < resultStr.length; i += chunkSize) {
        const chunk = resultStr.slice(i, i + chunkSize);
        sendEvent("chunk", { 
          data: chunk, 
          progress: Math.min(100, ((i + chunkSize) / resultStr.length) * 100) 
        });
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      sendEvent("complete", { result });
      res.end();
    } catch (error) {
      sendEvent("error", { 
        error: error instanceof Error ? error.message : String(error) 
      });
      res.end();
    }
  });

  // Execute tool with regular JSON response (non-streaming)
  app.post("/tools/:toolName", async (req, res) => {
    const { toolName } = req.params;
    const args = req.body;

    try {
      const result = await handleToolCall(toolName, args);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  const httpServer = createServer(app);

  httpServer.listen(HTTP_PORT, () => {
    console.log(`HubSpot MCP HTTP Server listening on port ${HTTP_PORT}`);
    console.log(`Health check: http://localhost:${HTTP_PORT}/health`);
    console.log(`List tools: http://localhost:${HTTP_PORT}/tools`);
    console.log(`Execute tool (streaming): POST http://localhost:${HTTP_PORT}/tools/:toolName/execute`);
    console.log(`Execute tool (regular): POST http://localhost:${HTTP_PORT}/tools/:toolName`);
  });
}

// STDIO Server
async function startStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HubSpot MCP Server running on stdio");
}

async function main() {
  if (MODE === "http") {
    startHttpServer();
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});