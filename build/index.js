#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
if (!HUBSPOT_API_KEY) {
    console.error("HUBSPOT_API_KEY environment variable is required");
    process.exit(1);
}
const HUBSPOT_API_BASE = "https://api.hubapi.com";
async function makeHubSpotRequest(endpoint, options = {}) {
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
const server = new Server({
    name: "hubspot-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
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
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;
        switch (name) {
            case "search_contacts": {
                const { query, limit = 10 } = args;
                const data = await makeHubSpotRequest(`/crm/v3/objects/contacts/search`, {
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
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }
            case "get_contact": {
                const { contactId } = args;
                const data = await makeHubSpotRequest(`/crm/v3/objects/contacts/${contactId}`);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }
            case "create_contact": {
                const properties = args;
                const data = await makeHubSpotRequest(`/crm/v3/objects/contacts`, {
                    method: "POST",
                    body: JSON.stringify({ properties }),
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }
            case "update_contact": {
                const { contactId, properties } = args;
                const data = await makeHubSpotRequest(`/crm/v3/objects/contacts/${contactId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ properties }),
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }
            case "list_deals": {
                const { limit = 10 } = args;
                const data = await makeHubSpotRequest(`/crm/v3/objects/deals?limit=${limit}`);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }
            case "create_deal": {
                const properties = args;
                const data = await makeHubSpotRequest(`/crm/v3/objects/deals`, {
                    method: "POST",
                    body: JSON.stringify({ properties }),
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }
            case "list_companies": {
                const { limit = 10 } = args;
                const data = await makeHubSpotRequest(`/crm/v3/objects/companies?limit=${limit}`);
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }
            case "create_company": {
                const properties = args;
                const data = await makeHubSpotRequest(`/crm/v3/objects/companies`, {
                    method: "POST",
                    body: JSON.stringify({ properties }),
                });
                return {
                    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
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
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("HubSpot MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
