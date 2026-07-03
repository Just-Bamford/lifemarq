#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

mod types;
mod registry;

use types::{ConsentRecord, ContractError};
use registry::Registry;

/// Lifemarq Soroban Smart Contract
/// 
/// Immutable donor consent registry on the Stellar blockchain.
/// 
/// # Event Hooks
/// 
/// All consent state transitions emit auditable events that enable backend observability.
/// Hospital systems and analytics can subscribe to these events for real-time updates.
/// 
/// ## Event Topics
/// 
/// ### `lifemarq.register`
/// Emitted when a new donor consent is registered
/// - **Topics**: (lifemarq, register)
/// - **Data**: (donor_id_hash: String, wallet: Address, timestamp: u64)
/// - **Ledger**: Immutable record on-chain
/// - **Use Case**: Analytics, audit trail, hospital notification of new registrations
/// 
/// ### `lifemarq.revoke`
/// Emitted when a donor revokes their consent
/// - **Topics**: (lifemarq, revoke)
/// - **Data**: (donor_id_hash: String, wallet: Address, timestamp: u64)
/// - **Ledger**: Updates existing record to is_active=false
/// - **Use Case**: Analytics, hospital notification of revoked consent, compliance audit
/// 
/// # State Machine
/// 
/// ```
///         register(wallet_auth)
///    ┌──────────────────────────┐
///    │                          ▼
/// (new) ─────────────────────► ACTIVE ◄─── consent_active=true
///                                 │
///                                 │ revoke(wallet_auth)
///                                 ▼
///                              REVOKED ◄─── consent_active=false (permanent)
/// ```
/// 
/// # Security Model
/// 
/// - **Authentication**: All mutating operations (register, revoke) require wallet.require_auth()
/// - **Authorization**: Only the original wallet can revoke a consent
/// - **Immutability**: Once revoked, consent cannot be re-activated
/// - **Transparency**: All transitions emit events for audit trail
#[contract]
pub struct LifemarqContract;

#[contractimpl]
impl LifemarqContract {
    /// Register a donor's consent on-chain
    /// 
    /// **Event**: Emits `lifemarq.register` event
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `donor_id_hash` - SHA-256 hash of national ID (hex string, 64 chars)
    /// * `wallet` - Donor's Stellar wallet address (must sign this call)
    /// * `organs` - List of organs to donate (e.g., ["kidney", "liver"])
    /// 
    /// # Returns
    /// * `Ok(())` if registration successful
    /// * `Err(AlreadyRegistered)` if already registered with this hash
    /// * `Err(Unauthorized)` if wallet did not authenticate
    /// 
    /// # State Transition
    /// (new) → ACTIVE
    pub fn register(
        env: Env,
        donor_id_hash: String,
        wallet: Address,
        organs: Vec<String>,
    ) -> Result<(), ContractError> {
        Registry::register(&env, donor_id_hash, wallet, organs)
    }

    /// Revoke a donor's consent (only the original signer can call this)
    /// 
    /// **Event**: Emits `lifemarq.revoke` event
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `donor_id_hash` - SHA-256 hash of national ID (hex string, 64 chars)
    /// * `wallet` - Donor's Stellar wallet address (must match original registrant)
    /// 
    /// # Returns
    /// * `Ok(())` if revocation successful
    /// * `Err(NotFound)` if consent record doesn't exist
    /// * `Err(AlreadyRevoked)` if consent already revoked (immutable state)
    /// * `Err(Unauthorized)` if wallet doesn't match original registrant
    /// 
    /// # State Transition
    /// ACTIVE → REVOKED (irreversible, permanent)
    pub fn revoke(
        env: Env,
        donor_id_hash: String,
        wallet: Address,
    ) -> Result<(), ContractError> {
        Registry::revoke(&env, donor_id_hash, wallet)
    }

    /// Query a donor's consent status (read-only, no auth required)
    /// 
    /// **No Event Emitted** (read-only query)
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `donor_id_hash` - SHA-256 hash of national ID (hex string, 64 chars)
    /// 
    /// # Returns
    /// * `true` if consent exists and is active
    /// * `false` if not found or revoked
    /// 
    /// Hospital systems use this to verify consent before transplant procedures
    pub fn query(env: Env, donor_id_hash: String) -> bool {
        Registry::query(&env, donor_id_hash)
    }

    /// Get full consent record (read-only, no auth required)
    /// 
    /// **No Event Emitted** (read-only query)
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `donor_id_hash` - SHA-256 hash of national ID (hex string, 64 chars)
    /// 
    /// # Returns
    /// * `Some(ConsentRecord)` with full details: wallet, organs, timestamp, status
    /// * `None` if not found
    /// 
    /// Includes registration timestamp and organ list for detailed consent verification
    pub fn get_record(env: Env, donor_id_hash: String) -> Option<ConsentRecord> {
        Registry::get_record(&env, donor_id_hash)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_register_succeeds_with_valid_inputs() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![
            &env,
            String::from_slice(&env, "kidney"),
            String::from_slice(&env, "liver"),
        ];

        let result = client.register(&donor_id_hash, &wallet, &organs);
        assert!(result.is_ok());
    }

    #[test]
    fn test_register_returns_already_registered_on_duplicate() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "kidney")];

        // First registration should succeed
        let result1 = client.register(&donor_id_hash, &wallet, &organs);
        assert!(result1.is_ok());

        // Second registration with same hash should fail
        let result2 = client.register(&donor_id_hash, &wallet, &organs);
        assert!(result2.is_err());
        assert_eq!(result2.unwrap_err(), ContractError::AlreadyRegistered);
    }

    #[test]
    fn test_query_returns_true_after_registration() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "kidney")];

        // Register
        let _ = client.register(&donor_id_hash, &wallet, &organs);

        // Query should return true
        let result = client.query(&donor_id_hash);
        assert!(result);
    }

    #[test]
    fn test_query_returns_false_for_unknown_hash() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let unknown_hash = String::from_slice(&env, "0000000000000000000000000000000000000000000000000000000000000000");

        // Query should return false
        let result = client.query(&unknown_hash);
        assert!(!result);
    }

    #[test]
    fn test_query_returns_false_after_revocation() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "kidney")];

        // Register
        let _ = client.register(&donor_id_hash, &wallet, &organs);

        // Query should return true
        assert!(client.query(&donor_id_hash));

        // Revoke
        let _ = client.revoke(&donor_id_hash, &wallet);

        // Query should return false
        assert!(!client.query(&donor_id_hash));
    }

    #[test]
    fn test_revoke_with_wrong_wallet_returns_unauthorized() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet1 = Address::random(&env);
        let wallet2 = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "kidney")];

        // Register with wallet1
        let _ = client.register(&donor_id_hash, &wallet1, &organs);

        // Try to revoke with wallet2 (should fail)
        let result = client.revoke(&donor_id_hash, &wallet2);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), ContractError::Unauthorized);
    }

    #[test]
    fn test_revoke_on_already_revoked_returns_already_revoked() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "kidney")];

        // Register
        let _ = client.register(&donor_id_hash, &wallet, &organs);

        // First revoke should succeed
        let result1 = client.revoke(&donor_id_hash, &wallet);
        assert!(result1.is_ok());

        // Second revoke should fail
        let result2 = client.revoke(&donor_id_hash, &wallet);
        assert!(result2.is_err());
        assert_eq!(result2.unwrap_err(), ContractError::AlreadyRevoked);
    }

    #[test]
    fn test_get_record_returns_full_record() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "a3f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "kidney")];

        // Register
        let _ = client.register(&donor_id_hash, &wallet, &organs);

        // Get record
        let record = client.get_record(&donor_id_hash);
        assert!(record.is_some());

        let rec = record.unwrap();
        assert_eq!(rec.donor_id_hash, donor_id_hash);
        assert_eq!(rec.wallet, wallet);
        assert!(rec.is_active);
    }

    #[test]
    fn test_get_record_returns_none_for_unknown_hash() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let unknown_hash = String::from_slice(&env, "0000000000000000000000000000000000000000000000000000000000000000");

        // Get record should return None
        let record = client.get_record(&unknown_hash);
        assert!(record.is_none());
    }
}
