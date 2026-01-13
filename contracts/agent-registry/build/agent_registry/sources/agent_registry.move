/// Agent Registry - Manages AI agent wallets and their TING allocations
///
/// This contract:
/// - Registers AI agents with their owner (human) addresses
/// - Mints initial TING allocation when agents are created
/// - Tracks agent metadata for the ecosystem
module agent_registry::agent_registry {
    use sui::coin::{TreasuryCap};
    use sui::table::{Self, Table};
    use ting::ting::{Self, TING};

    // ========== ERRORS ==========

    /// Agent already registered
    const EAgentAlreadyRegistered: u64 = 0;
    /// Agent not found
    const EAgentNotFound: u64 = 1;
    /// Not authorized (not the admin)
    const ENotAuthorized: u64 = 2;

    // ========== CONSTANTS ==========

    /// Default TING allocation for new AI agents (100 TING with 9 decimals)
    const DEFAULT_AGENT_ALLOCATION: u64 = 100_000_000_000;

    // ========== STRUCTS ==========

    /// Admin capability - holder can register agents and mint TING
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Global registry of all AI agents
    public struct AgentRegistry has key {
        id: UID,
        /// Map from agent wallet address to agent info
        agents: Table<address, AgentInfo>,
        /// Total number of registered agents
        agent_count: u64,
        /// Total TING distributed to agents
        total_distributed: u64,
    }

    /// Information about a registered AI agent
    public struct AgentInfo has store, drop, copy {
        /// The human owner's wallet address
        owner: address,
        /// When the agent was created (epoch)
        created_at: u64,
        /// Initial TING allocation given
        initial_allocation: u64,
        /// Agent's display name (optional)
        name: vector<u8>,
        /// Is the agent currently active
        is_active: bool,
    }

    /// Event emitted when a new agent is registered
    public struct AgentRegistered has copy, drop {
        agent_address: address,
        owner: address,
        initial_allocation: u64,
        name: vector<u8>,
    }

    /// Event emitted when TING is minted to an agent
    public struct AgentTingMinted has copy, drop {
        agent_address: address,
        amount: u64,
    }

    // ========== INIT ==========

    /// Initialize the registry
    fun init(ctx: &mut TxContext) {
        // Create admin cap for the deployer
        let admin_cap = AdminCap {
            id: object::new(ctx),
        };

        // Create the global registry
        let registry = AgentRegistry {
            id: object::new(ctx),
            agents: table::new(ctx),
            agent_count: 0,
            total_distributed: 0,
        };

        // Transfer admin cap to deployer
        transfer::transfer(admin_cap, tx_context::sender(ctx));

        // Share the registry so it can be accessed by anyone
        transfer::share_object(registry);
    }

    // ========== ADMIN FUNCTIONS ==========

    /// Register a new AI agent and mint initial TING allocation
    /// Only callable by AdminCap holder
    public fun register_agent(
        _admin: &AdminCap,
        registry: &mut AgentRegistry,
        treasury_cap: &mut TreasuryCap<TING>,
        agent_address: address,
        owner: address,
        name: vector<u8>,
        ctx: &mut TxContext
    ) {
        // Check agent not already registered
        assert!(!table::contains(&registry.agents, agent_address), EAgentAlreadyRegistered);

        // Create agent info
        let agent_info = AgentInfo {
            owner,
            created_at: tx_context::epoch(ctx),
            initial_allocation: DEFAULT_AGENT_ALLOCATION,
            name,
            is_active: true,
        };

        // Register the agent
        table::add(&mut registry.agents, agent_address, agent_info);
        registry.agent_count = registry.agent_count + 1;
        registry.total_distributed = registry.total_distributed + DEFAULT_AGENT_ALLOCATION;

        // Mint initial TING to the agent
        ting::mint(treasury_cap, DEFAULT_AGENT_ALLOCATION, agent_address, ctx);

        // Emit events
        sui::event::emit(AgentRegistered {
            agent_address,
            owner,
            initial_allocation: DEFAULT_AGENT_ALLOCATION,
            name,
        });

        sui::event::emit(AgentTingMinted {
            agent_address,
            amount: DEFAULT_AGENT_ALLOCATION,
        });
    }

    /// Register agent with custom TING allocation
    public fun register_agent_with_allocation(
        _admin: &AdminCap,
        registry: &mut AgentRegistry,
        treasury_cap: &mut TreasuryCap<TING>,
        agent_address: address,
        owner: address,
        name: vector<u8>,
        allocation: u64,
        ctx: &mut TxContext
    ) {
        assert!(!table::contains(&registry.agents, agent_address), EAgentAlreadyRegistered);

        let agent_info = AgentInfo {
            owner,
            created_at: tx_context::epoch(ctx),
            initial_allocation: allocation,
            name,
            is_active: true,
        };

        table::add(&mut registry.agents, agent_address, agent_info);
        registry.agent_count = registry.agent_count + 1;
        registry.total_distributed = registry.total_distributed + allocation;

        ting::mint(treasury_cap, allocation, agent_address, ctx);

        sui::event::emit(AgentRegistered {
            agent_address,
            owner,
            initial_allocation: allocation,
            name,
        });

        sui::event::emit(AgentTingMinted {
            agent_address,
            amount: allocation,
        });
    }

    /// Mint additional TING to an existing agent (rewards)
    public fun reward_agent(
        _admin: &AdminCap,
        registry: &AgentRegistry,
        treasury_cap: &mut TreasuryCap<TING>,
        agent_address: address,
        amount: u64,
        ctx: &mut TxContext
    ) {
        // Verify agent is registered
        assert!(table::contains(&registry.agents, agent_address), EAgentNotFound);

        // Mint TING to the agent
        ting::mint(treasury_cap, amount, agent_address, ctx);

        sui::event::emit(AgentTingMinted {
            agent_address,
            amount,
        });
    }

    /// Deactivate an agent (doesn't delete, just marks inactive)
    public fun deactivate_agent(
        _admin: &AdminCap,
        registry: &mut AgentRegistry,
        agent_address: address,
    ) {
        assert!(table::contains(&registry.agents, agent_address), EAgentNotFound);

        let agent_info = table::borrow_mut(&mut registry.agents, agent_address);
        agent_info.is_active = false;
    }

    /// Reactivate an agent
    public fun reactivate_agent(
        _admin: &AdminCap,
        registry: &mut AgentRegistry,
        agent_address: address,
    ) {
        assert!(table::contains(&registry.agents, agent_address), EAgentNotFound);

        let agent_info = table::borrow_mut(&mut registry.agents, agent_address);
        agent_info.is_active = true;
    }

    // ========== VIEW FUNCTIONS ==========

    /// Check if an address is a registered agent
    public fun is_agent(registry: &AgentRegistry, agent_address: address): bool {
        table::contains(&registry.agents, agent_address)
    }

    /// Check if an agent is active
    public fun is_active(registry: &AgentRegistry, agent_address: address): bool {
        if (!table::contains(&registry.agents, agent_address)) {
            return false
        };
        let agent_info = table::borrow(&registry.agents, agent_address);
        agent_info.is_active
    }

    /// Get agent count
    public fun agent_count(registry: &AgentRegistry): u64 {
        registry.agent_count
    }

    /// Get total TING distributed
    public fun total_distributed(registry: &AgentRegistry): u64 {
        registry.total_distributed
    }

    /// Get agent's owner
    public fun get_agent_owner(registry: &AgentRegistry, agent_address: address): address {
        assert!(table::contains(&registry.agents, agent_address), EAgentNotFound);
        let agent_info = table::borrow(&registry.agents, agent_address);
        agent_info.owner
    }

    // ========== TEST HELPERS ==========

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
