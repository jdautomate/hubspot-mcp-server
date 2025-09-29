// ============================================
// Node.js Client Example with SSE Streaming
// ============================================

import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';

// Example 1: List available tools
async function listTools() {
  const response = await fetch(`${API_URL}/tools`);
  const data = await response.json();
  console.log('Available tools:', JSON.stringify(data, null, 2));
}

// Example 2: Execute tool with streaming (SSE)
async function executeToolStreaming(toolName, args) {
  const response = await fetch(`${API_URL}/tools/${toolName}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  const reader = response.body;
  let buffer = '';

  reader.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    lines.forEach((line) => {
      if (line.startsWith('event:')) {
        const eventMatch = line.match(/event: (\w+)/);
        const dataMatch = line.match(/data: (.+)/);
        
        if (eventMatch && dataMatch) {
          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);
          
          console.log(`Event: ${event}`, data);
          
          if (event === 'chunk') {
            // Process chunks as they arrive
            process.stdout.write(data.data);
          } else if (event === 'complete') {
            console.log('\n✓ Complete!');
          } else if (event === 'error') {
            console.error('\n✗ Error:', data.error);
          }
        }
      }
    });
  });

  return new Promise((resolve) => {
    reader.on('end', resolve);
  });
}

// Example 3: Execute tool without streaming (regular JSON)
async function executeToolRegular(toolName, args) {
  const response = await fetch(`${API_URL}/tools/${toolName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  const data = await response.json();
  console.log('Result:', JSON.stringify(data, null, 2));
  return data;
}

// Example usage
async function main() {
  try {
    console.log('=== Listing Tools ===');
    await listTools();

    console.log('\n=== Searching Contacts (Streaming) ===');
    await executeToolStreaming('search_contacts', {
      query: 'example@email.com',
      limit: 5
    });

    console.log('\n=== Creating Contact (Regular) ===');
    await executeToolRegular('create_contact', {
      email: 'newcontact@example.com',
      firstname: 'John',
      lastname: 'Doe'
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run:
// main();

/* ============================================
   cURL Examples
   ============================================

# Health check
curl http://localhost:3000/health

# List available tools
curl http://localhost:3000/tools

# Search contacts (streaming with SSE)
curl -N -X POST http://localhost:3000/tools/search_contacts/execute \
  -H "Content-Type: application/json" \
  -d '{"query": "example@email.com", "limit": 5}'

# Search contacts (regular JSON response)
curl -X POST http://localhost:3000/tools/search_contacts \
  -H "Content-Type: application/json" \
  -d '{"query": "example@email.com", "limit": 5}'

# Create a contact
curl -X POST http://localhost:3000/tools/create_contact \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newcontact@example.com",
    "firstname": "John",
    "lastname": "Doe",
    "company": "Acme Inc"
  }'

# Get a specific contact
curl -X POST http://localhost:3000/tools/get_contact \
  -H "Content-Type: application/json" \
  -d '{"contactId": "123456"}'

# Update a contact
curl -X POST http://localhost:3000/tools/update_contact \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "123456",
    "properties": {
      "firstname": "Jane",
      "lastname": "Smith"
    }
  }'

# List deals
curl -X POST http://localhost:3000/tools/list_deals \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Create a deal
curl -X POST http://localhost:3000/tools/create_deal \
  -H "Content-Type: application/json" \
  -d '{
    "dealname": "New Partnership Deal",
    "amount": "50000",
    "dealstage": "appointmentscheduled"
  }'

   ============================================ */