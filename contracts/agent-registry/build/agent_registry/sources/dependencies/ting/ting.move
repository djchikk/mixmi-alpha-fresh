/// TING - AI collaboration token for creative economies
///
/// A minimal, stable foundation token. The smart logic lives elsewhere.
/// This contract only handles: mint, burn, transfer, treasury cap.
module ting::ting {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::url::{Self, Url};

    /// The TING token type - one-time witness for coin creation
    public struct TING has drop {}

    /// Mint capability - allows controlled minting by authorized contracts
    /// Can be shared with other contracts that need mint authority
    public struct MintCap has key, store {
        id: UID,
    }

    /// Initialize the TING token
    /// Creates TreasuryCap (for minting) and MintCap
    /// TreasuryCap is transferred to deployer
    fun init(witness: TING, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency<TING>(
            witness,
            9,                                              // 9 decimals (SUI standard)
            b"TING",                                        // Symbol
            b"TING",                                        // Name
            b"AI collaboration token for creative economies", // Description
            option::some(url::new_unsafe_from_bytes(
                b"https://mixmi.io/ting-icon.png"          // Icon URL (update later)
            )),
            ctx
        );

        // Create a MintCap that can be transferred to other contracts
        let mint_cap = MintCap {
            id: object::new(ctx),
        };

        // Transfer treasury cap and mint cap to deployer
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
        transfer::public_transfer(mint_cap, tx_context::sender(ctx));

        // Freeze metadata so it can't be changed
        transfer::public_freeze_object(metadata);
    }

    // ========== MINTING ==========

    /// Mint new TING tokens
    /// Only callable by treasury cap holder
    public fun mint(
        treasury_cap: &mut TreasuryCap<TING>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let minted = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(minted, recipient);
    }

    /// Mint and return the coin (for composability with other contracts)
    public fun mint_to_coin(
        treasury_cap: &mut TreasuryCap<TING>,
        amount: u64,
        ctx: &mut TxContext
    ): Coin<TING> {
        coin::mint(treasury_cap, amount, ctx)
    }

    // ========== BURNING ==========

    /// Burn TING tokens
    public fun burn(
        treasury_cap: &mut TreasuryCap<TING>,
        coin: Coin<TING>
    ) {
        coin::burn(treasury_cap, coin);
    }

    // ========== VIEW FUNCTIONS ==========

    /// Get total supply of TING
    public fun total_supply(treasury_cap: &TreasuryCap<TING>): u64 {
        coin::total_supply(treasury_cap)
    }

    // ========== TEST HELPERS ==========

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(TING {}, ctx)
    }
}
