/**
 * Backfill AI agents for existing personas
 *
 * This script finds all personas that have a SUI wallet but no AI agent,
 * and creates an agent for each one.
 *
 * Run with: node scripts/backfill-agents.js
 *
 * Options:
 *   --dry-run    Show what would be done without making changes
 *   --limit N    Only process N personas
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function getPersonasNeedingAgents() {
  // Get all personas with SUI addresses
  const { data: personas, error: personaError } = await supabase
    .from('personas')
    .select('id, username, display_name, sui_address, is_active')
    .not('sui_address', 'is', null)
    .eq('is_active', true);

  if (personaError) {
    throw new Error(`Failed to fetch personas: ${personaError.message}`);
  }

  // Get all existing agents
  const { data: agents, error: agentError } = await supabase
    .from('ai_agents')
    .select('persona_id')
    .eq('is_active', true);

  if (agentError) {
    throw new Error(`Failed to fetch agents: ${agentError.message}`);
  }

  const personasWithAgents = new Set(agents?.map(a => a.persona_id) || []);

  // Filter to personas without agents
  const needsAgent = personas?.filter(p => !personasWithAgents.has(p.id)) || [];

  return { personas: needsAgent, total: personas?.length || 0, existingAgents: agents?.length || 0 };
}

async function createAgentForPersona(personaId) {
  const response = await fetch(`${API_BASE}/api/ting/create-agent-for-persona`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create agent');
  }

  return response.json();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : null;

  console.log('\n🤖 AI Agent Backfill Script\n');
  console.log('Configuration:');
  console.log(`  API Base: ${API_BASE}`);
  console.log(`  Dry Run: ${dryRun}`);
  console.log(`  Limit: ${limit || 'none'}\n`);

  // Check if TING is configured
  if (!process.env.TING_PACKAGE_ID) {
    console.error('❌ TING is not configured. Set TING_PACKAGE_ID in .env.local');
    process.exit(1);
  }

  console.log('Fetching personas...\n');
  const { personas, total, existingAgents } = await getPersonasNeedingAgents();

  console.log(`📊 Status:`);
  console.log(`   Total personas with SUI wallets: ${total}`);
  console.log(`   Already have agents: ${existingAgents}`);
  console.log(`   Need agents: ${personas.length}\n`);

  if (personas.length === 0) {
    console.log('✅ All personas already have agents!');
    return;
  }

  const toProcess = limit ? personas.slice(0, limit) : personas;
  console.log(`Processing ${toProcess.length} personas...\n`);

  let success = 0;
  let failed = 0;
  const errors = [];

  for (const persona of toProcess) {
    const name = persona.display_name || persona.username;

    if (dryRun) {
      console.log(`  [DRY RUN] Would create agent for: ${name} (${persona.id})`);
      success++;
      continue;
    }

    try {
      process.stdout.write(`  Creating agent for ${name}...`);
      const result = await createAgentForPersona(persona.id);

      if (result.agent?.alreadyExisted) {
        console.log(' ⏭️  Already exists');
      } else {
        console.log(` ✅ ${result.agent?.address?.slice(0, 10)}...`);
      }
      success++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(` ❌ ${error.message}`);
      failed++;
      errors.push({ persona: name, error: error.message });
    }
  }

  console.log('\n📊 Results:');
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => console.log(`   - ${e.persona}: ${e.error}`));
  }

  console.log('\n✅ Backfill complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
