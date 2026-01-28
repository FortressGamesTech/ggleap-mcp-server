# GGLeap MCP Server

MCP server for GGLeap integration with Claude.

## Setup on New Machine

1. Clone the repository:
```bash
   git clone https://github.com/FortressGamesTech/ggleap-mcp-server.git
   cd ggleap-mcp-server
```

2. Install dependencies:
```bash
   npm install
```

3. Create `.env` file with your GGLeap API credentials:
```
   GGLEAP_AUTH_TOKEN=your_token_here
   GGLEAP_ENVIRONMENT=production
```

4. Build the project:
```bash
   npm run build
```

5. Configure Claude Desktop/Extension to use this MCP server (point to the dist folder)

## Usage

Your GGLeap API token can be found in the GGLeap admin panel.