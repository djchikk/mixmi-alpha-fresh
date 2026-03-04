# Mixmi Ops MCP Server

MCP server that connects Claude (via Cowork) to the mixmi-internal Supabase operations database. Enables conversational access to pilot node tracking, milestones, tasks, contacts, and engagement logs.

## Setup

### 1. Install dependencies

```bash
cd mixmi-ops-mcp-server
npm install
npm run build
```

### 2. Get your Supabase credentials

From the mixmi-internal Supabase dashboard:
- Go to **Settings → API**
- Copy the **Project URL** (looks like `https://xxxx.supabase.co`)
- Copy the **anon/public key** (the long string under "Project API keys")

### 3. Add to Claude Desktop

Open Claude Desktop → Settings → Developer → MCP Servers → Add

Add this configuration (replace the placeholder values):

```json
{
  "mcpServers": {
    "mixmi-ops": {
      "command": "node",
      "args": ["/FULL/PATH/TO/mixmi-ops-mcp-server/dist/index.js"],
      "env": {
        "MIXMI_OPS_SUPABASE_URL": "https://your-project.supabase.co",
        "MIXMI_OPS_SUPABASE_KEY": "your-anon-key-here"
      }
    }
  }
}
```

**Important:** Replace `/FULL/PATH/TO/` with the actual path on your machine.

### 4. Restart Claude Desktop

The MCP server should now be available. Test it by asking Claude:

> "Give me a dashboard overview of all pilot nodes"

## Available Tools

| Tool | What it does | Example prompt |
|------|-------------|----------------|
| `ops_dashboard` | Full operational dashboard | "What's the status of everything?" |
| `ops_node_overview` | Node status (all or specific) | "How's the Kenya node doing?" |
| `ops_list_milestones` | Filter milestones by stream/status | "Show me all in-progress platform milestones" |
| `ops_update_milestone` | Update milestone status | "Mark the database schema milestone as done" |
| `ops_list_tasks` | List and filter tasks | "What tasks are assigned to Joshua?" |
| `ops_create_task` | Create a new task | "Create a task for Joshua to introduce Felix" |
| `ops_log_engagement` | Log activity from nodes | "Log that Kenya had a session with 5 people today" |
| `ops_activity_feed` | Recent activity across nodes | "What's happened across all nodes this week?" |
| `ops_list_contacts` | Search/browse contacts | "Who are the contacts in the Kenya node?" |
| `ops_log_decision` | Record a decision with reasoning | "Log a decision: we chose email auth for ops portal" |

## For Different Team Members

**Sandy (Admin):** Full access. Use `ops_dashboard` for oversight. All tools available.

**Carolyn (Admin):** Same as Sandy. Use for generating investor reports, tracking comms.

**Joshua (Node Leader):** Note: RLS policies scope his access to Kenya node data. He'll see his node's tasks, milestones, and contacts but not investor data or financials.

## Architecture

```
Claude (Cowork) → MCP Server (stdio) → Supabase REST API → mixmi-internal DB
                                                             ├── pilot_nodes
                                                             ├── milestones
                                                             ├── tasks
                                                             ├── community_contacts
                                                             ├── engagement_logs
                                                             └── decisions_log
```

The server uses the Supabase anon key, so all queries go through Row Level Security. Each user's access is automatically scoped by their role in the `user_roles` table.
