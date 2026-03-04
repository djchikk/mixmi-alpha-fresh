import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = process.env.MIXMI_OPS_SUPABASE_URL;
const SUPABASE_KEY = process.env.MIXMI_OPS_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Error: MIXMI_OPS_SUPABASE_URL and MIXMI_OPS_SUPABASE_KEY environment variables are required.\n" +
    "Set them in your Claude Desktop MCP config or shell environment."
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// HELPERS
// ============================================================

function formatDate(d: string | null): string {
  if (!d) return "not set";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric"
  });
}

function textResponse(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResponse(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

// ============================================================
// SERVER
// ============================================================

const server = new McpServer({
  name: "mixmi-ops-mcp-server",
  version: "1.0.0",
});

// ============================================================
// TOOL: ops_node_overview
// Get a snapshot of all pilot nodes or a specific one
// ============================================================

server.registerTool(
  "ops_node_overview",
  {
    title: "Pilot Node Overview",
    description:
      "Get the current status of all pilot nodes, or a specific node by name. " +
      "Returns node status, lead, participant count, recent activity, and active/blocked tasks. " +
      "Use without parameters for a full dashboard snapshot.",
    inputSchema: {
      node_name: z.string().optional().describe("Filter to a specific node by name (e.g. 'Kenya Node'). Omit for all nodes."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ node_name }) => {
    let query = supabase.from("node_overview").select("*");
    if (node_name) {
      query = query.ilike("name", `%${node_name}%`);
    }
    const { data, error } = await query;
    if (error) return errorResponse(error.message);
    if (!data || data.length === 0) return textResponse("No pilot nodes found matching that name.");

    const lines = data.map((n: Record<string, unknown>) =>
      `## ${n.name}\n` +
      `- **Status:** ${n.status}\n` +
      `- **Lead:** ${n.lead_name || "unassigned"}\n` +
      `- **Participants:** ${n.participant_count}\n` +
      `- **Activation date:** ${formatDate(n.activation_date as string | null)}\n` +
      `- **Active tasks:** ${n.active_tasks} | **Blocked:** ${n.blocked_tasks}\n` +
      `- **Engagement events (total):** ${n.total_engagement_events} | **Last 7 days:** ${n.events_last_7_days}\n` +
      `- **Last activity:** ${formatDate(n.last_activity as string | null)}`
    );
    return textResponse(lines.join("\n\n"));
  }
);

// ============================================================
// TOOL: ops_list_milestones
// List milestones with filtering
// ============================================================

server.registerTool(
  "ops_list_milestones",
  {
    title: "List Milestones",
    description:
      "List milestones across all workstreams, with optional filters by stream, status, or node. " +
      "Streams: platform, pilot, tooling, investor, ops. " +
      "Statuses: planned, next, in_progress, blocked, done.",
    inputSchema: {
      stream: z.enum(["platform", "pilot", "tooling", "investor", "ops"]).optional()
        .describe("Filter by workstream"),
      status: z.enum(["planned", "next", "in_progress", "blocked", "done"]).optional()
        .describe("Filter by status"),
      node_name: z.string().optional()
        .describe("Filter by pilot node name"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ stream, status, node_name }) => {
    let query = supabase
      .from("milestones")
      .select("*, pilot_nodes(name)")
      .order("created_at", { ascending: true });

    if (stream) query = query.eq("stream", stream);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return errorResponse(error.message);
    if (!data || data.length === 0) return textResponse("No milestones found with those filters.");

    let filtered = data;
    if (node_name) {
      filtered = data.filter((m: Record<string, unknown>) => {
        const node = m.pilot_nodes as Record<string, unknown> | null;
        return node && (node.name as string).toLowerCase().includes(node_name.toLowerCase());
      });
    }

    const statusIcon: Record<string, string> = {
      done: "✅", in_progress: "🔄", next: "⭐", blocked: "🚫", planned: "📋"
    };

    const lines = filtered.map((m: Record<string, unknown>) => {
      const node = m.pilot_nodes as Record<string, unknown> | null;
      const nodeName = node ? ` [${node.name}]` : "";
      return `${statusIcon[m.status as string] || "📋"} **${m.title}**${nodeName}\n` +
        `   Stream: ${m.stream} | Status: ${m.status} | Target: ${m.target_week || "TBD"} | Owner: ${m.owner || "unassigned"}` +
        (m.description ? `\n   ${m.description}` : "");
    });

    return textResponse(`# Milestones (${filtered.length} results)\n\n${lines.join("\n\n")}`);
  }
);

// ============================================================
// TOOL: ops_update_milestone
// Update a milestone's status or details
// ============================================================

server.registerTool(
  "ops_update_milestone",
  {
    title: "Update Milestone",
    description:
      "Update a milestone's status, target week, owner, or mark it complete. " +
      "Find the milestone by title (partial match supported).",
    inputSchema: {
      title_search: z.string().describe("Part of the milestone title to find it"),
      status: z.enum(["planned", "next", "in_progress", "blocked", "done"]).optional()
        .describe("New status"),
      target_week: z.string().optional().describe("New target week (e.g. 'W3-4')"),
      owner: z.string().optional().describe("New owner name"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ title_search, status, target_week, owner }) => {
    // Find the milestone
    const { data: matches, error: findError } = await supabase
      .from("milestones")
      .select("id, title, status")
      .ilike("title", `%${title_search}%`);

    if (findError) return errorResponse(findError.message);
    if (!matches || matches.length === 0) return textResponse(`No milestone found matching "${title_search}".`);
    if (matches.length > 1) {
      const names = matches.map((m: Record<string, unknown>) => `- ${m.title}`).join("\n");
      return textResponse(`Multiple milestones match "${title_search}". Be more specific:\n${names}`);
    }

    const milestone = matches[0] as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (target_week) updates.target_week = target_week;
    if (owner) updates.owner = owner;
    if (status === "done") updates.completed_date = new Date().toISOString().split("T")[0];

    if (Object.keys(updates).length === 0) {
      return textResponse("No updates provided. Specify status, target_week, or owner.");
    }

    const { error: updateError } = await supabase
      .from("milestones")
      .update(updates)
      .eq("id", milestone.id);

    if (updateError) return errorResponse(updateError.message);
    return textResponse(`Updated "${milestone.title}": ${Object.entries(updates).map(([k, v]) => `${k} → ${v}`).join(", ")}`);
  }
);

// ============================================================
// TOOL: ops_list_tasks
// List tasks with filtering
// ============================================================

server.registerTool(
  "ops_list_tasks",
  {
    title: "List Tasks",
    description:
      "List tasks across all nodes, with optional filters. " +
      "Returns priority-sorted tasks with their milestone context.",
    inputSchema: {
      status: z.enum(["planned", "next", "in_progress", "blocked", "done"]).optional()
        .describe("Filter by status"),
      node_name: z.string().optional().describe("Filter by pilot node name"),
      assignee: z.string().optional().describe("Filter by assignee name"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ status, node_name, assignee }) => {
    const { data, error } = await supabase.from("upcoming_tasks").select("*");
    if (error) return errorResponse(error.message);
    if (!data || data.length === 0) return textResponse("No tasks found. Tasks will appear as you create them.");

    let filtered = data;
    if (status) filtered = filtered.filter((t: Record<string, unknown>) => t.status === status);
    if (node_name) filtered = filtered.filter((t: Record<string, unknown>) =>
      (t.node_name as string | null)?.toLowerCase().includes(node_name.toLowerCase()));
    if (assignee) filtered = filtered.filter((t: Record<string, unknown>) =>
      (t.assignee as string | null)?.toLowerCase().includes(assignee.toLowerCase()));

    if (filtered.length === 0) return textResponse("No tasks match those filters.");

    const lines = filtered.map((t: Record<string, unknown>) =>
      `- [${t.priority}] **${t.title}** — ${t.status}` +
      (t.node_name ? ` (${t.node_name})` : "") +
      (t.assignee ? ` → ${t.assignee}` : "") +
      (t.due_date ? ` | Due: ${formatDate(t.due_date as string)}` : "") +
      (t.milestone_title ? `\n  Milestone: ${t.milestone_title}` : "")
    );
    return textResponse(`# Tasks (${filtered.length})\n\n${lines.join("\n\n")}`);
  }
);

// ============================================================
// TOOL: ops_create_task
// Create a new task
// ============================================================

server.registerTool(
  "ops_create_task",
  {
    title: "Create Task",
    description:
      "Create a new task, optionally linked to a milestone and pilot node.",
    inputSchema: {
      title: z.string().min(3).describe("Task title"),
      description: z.string().optional().describe("Task description"),
      assignee: z.string().optional().describe("Who is responsible"),
      priority: z.enum(["p0", "p1", "p2", "p3"]).default("p2").describe("Priority level"),
      status: z.enum(["planned", "next", "in_progress"]).default("planned").describe("Initial status"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      milestone_search: z.string().optional().describe("Part of milestone title to link to"),
      node_name: z.string().optional().describe("Pilot node name to associate with"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ title, description, assignee, priority, status, due_date, milestone_search, node_name }) => {
    let milestone_id: string | null = null;
    let pilot_node_id: string | null = null;

    if (milestone_search) {
      const { data } = await supabase
        .from("milestones").select("id, title").ilike("title", `%${milestone_search}%`).limit(1);
      if (data && data.length > 0) milestone_id = (data[0] as Record<string, unknown>).id as string;
    }

    if (node_name) {
      const { data } = await supabase
        .from("pilot_nodes").select("id, name").ilike("name", `%${node_name}%`).limit(1);
      if (data && data.length > 0) pilot_node_id = (data[0] as Record<string, unknown>).id as string;
    }

    const { data, error } = await supabase.from("tasks").insert({
      title, description, assignee, priority, status,
      due_date: due_date || null,
      milestone_id, pilot_node_id,
    }).select("id, title").single();

    if (error) return errorResponse(error.message);
    return textResponse(`Created task: "${title}" (${priority}, ${status})` +
      (assignee ? ` → ${assignee}` : "") +
      (due_date ? ` | Due: ${due_date}` : ""));
  }
);

// ============================================================
// TOOL: ops_log_engagement
// Log an activity/engagement event
// ============================================================

server.registerTool(
  "ops_log_engagement",
  {
    title: "Log Engagement",
    description:
      "Log an activity or engagement event for a pilot node. " +
      "Use this when a node leader reports activity: sessions, uploads, meetings, feedback, etc.",
    inputSchema: {
      node_name: z.string().describe("Pilot node name"),
      event: z.enum(["upload", "comment", "question", "session", "meeting", "feedback", "milestone_hit", "other"])
        .describe("Type of event"),
      title: z.string().describe("Short summary of what happened"),
      description: z.string().optional().describe("Longer detail"),
      participant_count: z.number().int().optional().describe("Number of participants (for sessions/meetings)"),
      is_public: z.boolean().default(true).describe("Visible to other nodes?"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ node_name, event, title, description, participant_count, is_public }) => {
    const { data: nodes } = await supabase
      .from("pilot_nodes").select("id, name").ilike("name", `%${node_name}%`).limit(1);

    if (!nodes || nodes.length === 0) return errorResponse(`No node found matching "${node_name}".`);
    const node = nodes[0] as Record<string, unknown>;

    const { error } = await supabase.from("engagement_logs").insert({
      pilot_node_id: node.id,
      event, title, description,
      participant_count: participant_count || null,
      is_public,
    });

    if (error) return errorResponse(error.message);
    return textResponse(
      `Logged ${event} for ${node.name}: "${title}"` +
      (participant_count ? ` (${participant_count} participants)` : "")
    );
  }
);

// ============================================================
// TOOL: ops_activity_feed
// Get recent activity across nodes
// ============================================================

server.registerTool(
  "ops_activity_feed",
  {
    title: "Activity Feed",
    description:
      "Get recent engagement activity across all pilot nodes. " +
      "Shows uploads, sessions, meetings, and other logged events.",
    inputSchema: {
      node_name: z.string().optional().describe("Filter to a specific node"),
      limit: z.number().int().min(1).max(50).default(20).describe("Number of events to return"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ node_name, limit }) => {
    let query = supabase
      .from("activity_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (node_name) query = query.ilike("node_name", `%${node_name}%`);

    const { data, error } = await query;
    if (error) return errorResponse(error.message);
    if (!data || data.length === 0) return textResponse("No activity logged yet. Use ops_log_engagement to record events.");

    const lines = data.map((e: Record<string, unknown>) =>
      `- **${formatDate(e.created_at as string)}** [${e.node_name}] ${e.event}: ${e.title}` +
      (e.participant_count ? ` (${e.participant_count} people)` : "") +
      (e.description ? `\n  ${e.description}` : "")
    );
    return textResponse(`# Recent Activity\n\n${lines.join("\n")}`);
  }
);

// ============================================================
// TOOL: ops_list_contacts
// Search community contacts
// ============================================================

server.registerTool(
  "ops_list_contacts",
  {
    title: "List Contacts",
    description:
      "Search or list community contacts (CRM). Filter by node, relationship stage, or search by name.",
    inputSchema: {
      search: z.string().optional().describe("Search by name or role"),
      node_name: z.string().optional().describe("Filter by pilot node"),
      stage: z.enum(["prospect", "contacted", "engaged", "active", "advocate"]).optional()
        .describe("Filter by relationship stage"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ search, node_name, stage }) => {
    let query = supabase
      .from("community_contacts")
      .select("*, pilot_nodes(name)")
      .order("name");

    if (search) query = query.or(`name.ilike.%${search}%,role.ilike.%${search}%`);
    if (stage) query = query.eq("relationship_stage", stage);

    const { data, error } = await query;
    if (error) return errorResponse(error.message);
    if (!data || data.length === 0) return textResponse("No contacts found matching those filters.");

    let filtered = data;
    if (node_name) {
      filtered = data.filter((c: Record<string, unknown>) => {
        const node = c.pilot_nodes as Record<string, unknown> | null;
        return node && (node.name as string).toLowerCase().includes(node_name.toLowerCase());
      });
    }

    const lines = filtered.map((c: Record<string, unknown>) => {
      const node = c.pilot_nodes as Record<string, unknown> | null;
      return `- **${c.name}** — ${c.role || "no role"}` +
        (node ? ` [${node.name}]` : "") +
        ` | Stage: ${c.relationship_stage}` +
        (c.next_followup ? ` | Follow up: ${formatDate(c.next_followup as string)}` : "") +
        (c.context ? `\n  ${(c.context as string).slice(0, 150)}...` : "");
    });
    return textResponse(`# Contacts (${filtered.length})\n\n${lines.join("\n\n")}`);
  }
);

// ============================================================
// TOOL: ops_log_decision
// Record a decision
// ============================================================

server.registerTool(
  "ops_log_decision",
  {
    title: "Log Decision",
    description:
      "Record a decision in the decisions log with context and reasoning. " +
      "Important for institutional memory — captures the WHY behind choices.",
    inputSchema: {
      title: z.string().describe("Short title of the decision"),
      decision: z.string().describe("What was decided"),
      context: z.string().optional().describe("What prompted this decision"),
      reasoning: z.string().optional().describe("Why this choice was made"),
      decided_by: z.string().default("Sandy").describe("Who made the decision"),
      is_public: z.boolean().default(false).describe("Visible to node leaders?"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async ({ title, decision, context, reasoning, decided_by, is_public }) => {
    const { error } = await supabase.from("decisions_log").insert({
      title, decision, context, reasoning, decided_by, is_public,
      decided_at: new Date().toISOString().split("T")[0],
    });
    if (error) return errorResponse(error.message);
    return textResponse(`Decision logged: "${title}" by ${decided_by}`);
  }
);

// ============================================================
// TOOL: ops_dashboard
// Full dashboard summary
// ============================================================

server.registerTool(
  "ops_dashboard",
  {
    title: "Full Dashboard",
    description:
      "Get a comprehensive operational dashboard: all node statuses, in-progress milestones, " +
      "upcoming tasks, recent activity, and pending follow-ups. " +
      "Use this for a complete status check.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    // Nodes
    const { data: nodes } = await supabase.from("node_overview").select("*");

    // Active milestones
    const { data: activeMilestones } = await supabase
      .from("milestones").select("title, stream, status, target_week, owner")
      .in("status", ["in_progress", "next"])
      .order("created_at");

    // Recent activity
    const { data: recentActivity } = await supabase
      .from("activity_feed").select("*")
      .order("created_at", { ascending: false }).limit(5);

    // Contacts needing follow-up
    const { data: followups } = await supabase
      .from("community_contacts").select("name, next_followup, pilot_nodes(name)")
      .not("next_followup", "is", null)
      .order("next_followup").limit(5);

    let output = "# Mixmi Ops Dashboard\n\n";

    // Nodes section
    output += "## Pilot Nodes\n";
    if (nodes) {
      for (const n of nodes as Record<string, unknown>[]) {
        output += `- **${n.name}** — ${n.status} | Lead: ${n.lead_name} | ` +
          `Tasks: ${n.active_tasks} active, ${n.blocked_tasks} blocked | ` +
          `Events (7d): ${n.events_last_7_days}\n`;
      }
    }

    // Active milestones
    output += "\n## Active & Next Milestones\n";
    if (activeMilestones && activeMilestones.length > 0) {
      for (const m of activeMilestones as Record<string, unknown>[]) {
        const icon = m.status === "in_progress" ? "🔄" : "⭐";
        output += `${icon} [${m.stream}] **${m.title}** — ${m.target_week || "TBD"} (${m.owner})\n`;
      }
    } else {
      output += "No active milestones.\n";
    }

    // Recent activity
    output += "\n## Recent Activity\n";
    if (recentActivity && recentActivity.length > 0) {
      for (const e of recentActivity as Record<string, unknown>[]) {
        output += `- ${formatDate(e.created_at as string)} [${e.node_name}] ${e.title}\n`;
      }
    } else {
      output += "No activity logged yet.\n";
    }

    // Follow-ups
    output += "\n## Upcoming Follow-ups\n";
    if (followups && followups.length > 0) {
      for (const f of followups as Record<string, unknown>[]) {
        const node = f.pilot_nodes as Record<string, unknown> | null;
        output += `- **${f.name}** — ${formatDate(f.next_followup as string)}` +
          (node ? ` (${node.name})` : "") + "\n";
      }
    } else {
      output += "No pending follow-ups.\n";
    }

    return textResponse(output);
  }
);

// ============================================================
// START SERVER
// ============================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mixmi Ops MCP server running on stdio");
}

main().catch((error: Error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
