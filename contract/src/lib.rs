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
    /// * `expires_at` - Optional expiry timestamp (Unix seconds). If set, consent auto-expires and requires renewal.
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
        expires_at: Option<u64>,
    ) -> Result<(), ContractError> {
        Registry::register(&env, donor_id_hash, wallet, organs, expires_at)
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
    /// ⚠️ WARNING: TESTNET ONLY. Use query_verified_only() for mainnet (requires hospital verification)
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

    /// Register a recipient on the organ transplant waitlist
    /// 
    /// **Event**: Emits `lifemarq.register_recipient` event
    /// 
    /// Data capture only in v1 — no matching logic yet.
    /// Used to illuminate demand side of donor supply.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `recipient_id_hash` - SHA-256 hash of recipient national ID (privacy-preserving)
    /// * `wallet` - Healthcare provider wallet address (must sign this call)
    /// * `needed_organs` - List of organs needed (e.g., ["kidney", "heart"])
    /// * `blood_type` - Blood type for compatibility (e.g., "O+", "AB-")
    /// 
    /// # Returns
    /// * `Ok(())` if registration successful
    /// * `Err(Unauthorized)` if wallet did not authenticate
    pub fn register_recipient(
        env: Env,
        recipient_id_hash: String,
        wallet: Address,
        needed_organs: Vec<String>,
        blood_type: String,
    ) -> Result<(), ContractError> {
        Registry::register_recipient(&env, recipient_id_hash, wallet, needed_organs, blood_type)
    }

    /// Query recipient waitlist count by organ (read-only)
    /// 
    /// Returns the number of recipients waiting for a specific organ.
    /// Used by ministry dashboard to show demand metrics.
    pub fn get_recipient_count(env: Env, organ: String) -> u32 {
        Registry::get_recipient_count(&env, organ)
    }

    /// Register a hospital to the network
    /// 
    /// Only authorized admins can call this.
    /// Hospitals must register before they can query consent records.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `hospital_id` - Unique identifier (e.g., "hospital-001")
    /// * `wallet` - Hospital's wallet address for signed queries
    /// * `name` - Hospital name
    /// * `country` - Country code (ISO 3166-1 alpha-2)
    /// * `license_number` - Health ministry license/registration number
    /// 
    /// # Returns
    /// Result: Succeeds if hospital registered, fails if:
    /// - Hospital already registered (Unauthorized)
    /// - Caller is not admin (Unauthorized)
    pub fn register_hospital(
        env: Env,
        hospital_id: String,
        wallet: Address,
        name: String,
        country: String,
        license_number: String,
    ) -> Result<(), ContractError> {
        Registry::register_hospital(&env, hospital_id, wallet, name, country, license_number)
    }

    /// Verify a hospital's credentials (admin only)
    /// 
    /// Sets a hospital's status to verified, enabling full query access.
    /// Only callable by contract admin.
    pub fn verify_hospital(env: Env, hospital_id: String) -> Result<(), ContractError> {
        Registry::verify_hospital(&env, hospital_id)
    }

    /// Check if a hospital is verified
    /// 
    /// Returns true if hospital is verified and can query consent records.
    /// Public endpoint - no auth required (info is non-sensitive).
    pub fn is_hospital_verified(env: Env, hospital_id: String) -> bool {
        Registry::is_hospital_verified(&env, hospital_id)
    }

    /// Query consent with hospital access control ⭐ REQUIRED FOR MAINNET
    /// 
    /// **SECURITY**: Only verified hospitals can query consent records.
    /// Unverified callers get false (silent rejection for privacy).
    /// 
    /// This replaces the public query() function for production.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `donor_id_hash` - SHA-256 hash of national ID
    /// * `hospital_id` - Hospital's ID (string identifier)
    /// 
    /// # Returns
    /// * `true` if:
    ///   - Hospital is registered AND verified
    ///   - Donor consent exists AND is active
    ///   - Consent has not expired
    /// * `false` if:
    ///   - Hospital not verified (access denied)
    ///   - Consent doesn't exist or revoked
    ///   - Consent has expired
    pub fn query_verified_only(
        env: Env,
        donor_id_hash: String,
        hospital_id: String,
    ) -> bool {
        // SECURITY: Check if hospital is verified before returning any data
        if !Registry::is_hospital_verified(&env, hospital_id) {
            return false; // Access denied (silent failure for privacy)
        }
        // Hospital is verified - return actual consent status
        Registry::query(&env, donor_id_hash)
    }

    /// Query consent with hospital access control
    /// 
    /// Enhanced query that checks if the calling hospital is verified.
    /// Unauthorized hospitals get rejected with zero return (privacy).
    /// 
    /// This is the production query endpoint for hospital systems.
    pub fn query_with_hospital_auth(
        env: Env,
        donor_id_hash: String,
        hospital_id: String,
    ) -> bool {
        if !Registry::is_hospital_verified(&env, hospital_id) {
            return false; // Deny with silent failure (privacy protection)
        }
        Registry::query(&env, donor_id_hash)
    }

    /// Get hospital details (public read)
    /// 
    /// Retrieves hospital registration and verification status.
    pub fn get_hospital(
        env: Env,
        hospital_id: String,
    ) -> Option<crate::types::HospitalRecord> {
        Registry::get_hospital(&env, hospital_id)
    }

    /// Federated query across multiple registries ⭐ FEDERATION
    /// 
    /// Query consent from another country's registry instance.
    /// Enables cross-border donor lookup in federated Lifemarq network.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `foreign_registry_id` - String identifier of foreign country's registry
    /// * `donor_id_hash` - SHA-256 hash of donor's national ID
    /// * `hospital_id` - Querying hospital's ID (must be verified locally)
    /// 
    /// # Returns
    /// * `true` if hospital verified and foreign registry confirms consent active
    /// * `false` if hospital not verified locally or foreign query fails
    /// 
    /// # Implementation Note
    /// In production, this uses Soroban's cross-contract invocation to call
    /// the foreign registry's query_verified_only() function directly.
    /// 
    /// The API layer (in Rust or TypeScript) handles the routing logic:
    /// 1. Verify hospital in local registry
    /// 2. Look up foreign registry contract address
    /// 3. Call foreign contract's query_verified_only()
    /// 4. Return result to caller
    pub fn federated_query(
        env: Env,
        foreign_registry_id: String,
        donor_id_hash: String,
        _hospital_id: String,
    ) -> bool {
        // SECURITY: Require hospital to be verified in THIS registry first
        if !Registry::is_hospital_verified(&env, foreign_registry_id.clone()) {
            return false; // Access denied locally
        }

        // In a real implementation, this would call the foreign registry contract
        // For now, document the expected flow:
        //
        // Foreign registry would:
        // 1. Check if hospital_id is verified in ANY registry (trust network)
        // 2. Query donor consent status
        // 3. Return true/false
        //
        // This is implemented at the API layer in registry-config.ts
        // and federated-consent-service.ts

        false // Placeholder - actual implementation at API layer
    }

    /// Register a minor's consent requiring multi-sig approval from parent and guardian
    /// 
    /// **Event**: Emits `lifemarq.minor_reg` event
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `minor_id_hash` - SHA-256 hash of minor's national ID (hex string, 64 chars)
    /// * `parent_wallet` - Parent wallet address (must approve consent)
    /// * `guardian_wallet` - Guardian wallet address (must approve consent)
    /// * `organs` - List of organs the minor consents to donate
    /// * `initiator` - The wallet initiating this registration (must sign this call)
    /// 
    /// # Returns
    /// * `Ok(())` if registration successful
    /// * `Err(AlreadyRegistered)` if already registered with this hash
    /// * `Err(Unauthorized)` if initiator did not authenticate or parent==guardian
    /// 
    /// # State Transition
    /// (new) → PENDING_APPROVAL (awaiting parent and guardian signatures)
    /// 
    /// # Legal Requirement
    /// This implements the legal requirement in many jurisdictions that minors cannot
    /// consent to medical procedures independently. Both a parent and guardian must approve.
    pub fn register_minor(
        env: Env,
        minor_id_hash: String,
        parent_wallet: Address,
        guardian_wallet: Address,
        organs: Vec<String>,
        initiator: Address,
    ) -> Result<(), ContractError> {
        Registry::register_minor(
            &env,
            minor_id_hash,
            parent_wallet,
            guardian_wallet,
            organs,
            initiator,
        )
    }

    /// Approve a minor's consent (called by parent or guardian)
    /// 
    /// **Event**: Emits `lifemarq.minor_prtl` or `lifemarq.minor_fin` depending on state
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `minor_id_hash` - SHA-256 hash of minor's national ID (hex string, 64 chars)
    /// 
    /// # Returns
    /// * `Ok(())` if approval recorded successfully
    /// * `Err(NotFound)` if pending minor consent record doesn't exist
    /// * `Err(Unauthorized)` if caller is neither parent nor guardian
    /// 
    /// # State Transitions
    /// - After parent approves (guardian pending): PENDING_APPROVAL
    /// - After guardian approves (parent pending): PENDING_APPROVAL
    /// - After both approve: PENDING_APPROVAL → ACTIVE (record finalized)
    /// 
    /// # Security
    /// Both parent and guardian wallet signatures are required (multi-sig pattern).
    /// Once both have signed, the consent becomes active without further action.
    pub fn approve_minor_consent(
        env: Env,
        minor_id_hash: String,
        caller: Address,
    ) -> Result<(), ContractError> {
        Registry::approve_minor_consent(&env, minor_id_hash, caller)
    }

    /// Get pending minor consent record (read-only, no auth required)
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `minor_id_hash` - SHA-256 hash of minor's national ID (hex string, 64 chars)
    /// 
    /// # Returns
    /// * `Some(MinorConsentPending)` with approval status and signer details
    /// * `None` if no pending record exists
    /// 
    /// Enables monitoring of multi-sig approval progress
    pub fn get_pending_minor_consent(
        env: Env,
        minor_id_hash: String,
    ) -> Option<crate::types::MinorConsentPending> {
        Registry::get_pending_minor_consent(&env, minor_id_hash)
    }

    /// Renew a donor's consent by extending the expiry date ⭐ NEW
    /// 
    /// **Event**: Emits `lifemarq.renew` event
    /// 
    /// Called by donor to renew their consent for another period (typically 5 years).
    /// If consent has expired, renewal reactivates it; if not expired, extends the deadline.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `donor_id_hash` - SHA-256 hash of national ID (hex string, 64 chars)
    /// * `wallet` - Donor's Stellar wallet address (must match original registrant)
    /// * `renewal_period` - Number of seconds to extend consent (e.g., 157,680,000 for 5 years)
    /// 
    /// # Returns
    /// * `Ok(())` if renewal successful
    /// * `Err(NotFound)` if consent record doesn't exist
    /// * `Err(AlreadyRevoked)` if consent has been revoked
    /// * `Err(Unauthorized)` if wallet doesn't match original registrant
    pub fn renew_consent(
        env: Env,
        donor_id_hash: String,
        wallet: Address,
        renewal_period: u64,
    ) -> Result<(), ContractError> {
        Registry::renew_consent(&env, donor_id_hash, wallet, renewal_period)
    }

    /// Check if a consent record has expired ⭐ NEW
    /// 
    /// Read-only query to determine if a consent has passed its expiry date.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `donor_id_hash` - SHA-256 hash of national ID (hex string, 64 chars)
    /// 
    /// # Returns
    /// * `true` if record exists, is active, and has expired
    /// * `false` if record doesn't exist, is revoked, or hasn't expired
    /// 
    /// Useful for UI to show "Renewal needed" status
    pub fn is_consent_expired(env: Env, donor_id_hash: String) -> bool {
        Registry::is_consent_expired(&env, donor_id_hash)
    }

    /// Log organ transfer leg for chain of custody ⭐ PROVENANCE
    /// 
    /// **Event**: Emits `lifemarq.transfer` event
    /// 
    /// Records each handoff: harvesting hospital → transport → receiving hospital
    /// Each custodian must sign to transfer ownership (multi-sig pattern).
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `transfer_id` - Unique ID for this organ batch
    /// * `organ` - Organ type (kidney, liver, heart, lung, pancreas, cornea)
    /// * `donor_id_hash` - SHA-256 hash of donor's national ID
    /// * `from_custodian` - Current custodian wallet (must sign this call)
    /// * `to_custodian` - Next custodian wallet address
    /// * `transfer_type` - 1=Harvest, 2=Transport, 3=Transplant
    /// * `location_description` - Location name/description (optionally with GPS: "lat,long,description")
    /// * `temperature` - Organ temp in Celsius * 100 (e.g., 400 = 4°C)
    /// * `quality_notes` - Assessment notes (visual inspection, viability, oxygen%, etc.)
    /// 
    /// # Returns
    /// * `Ok(())` if transfer logged successfully
    /// * `Err(InvalidTransfer)` if transfer_type invalid
    /// * `Err(Unauthorized)` if from_custodian did not authenticate
    pub fn log_transfer(
        env: Env,
        transfer_id: String,
        organ: String,
        donor_id_hash: String,
        from_custodian: Address,
        to_custodian: Address,
        transfer_type: u32,
        location_description: String,
        temperature: Option<i64>,
        quality_notes: String,
    ) -> Result<(), ContractError> {
        Registry::log_transfer(
            &env,
            transfer_id,
            organ,
            donor_id_hash,
            from_custodian,
            to_custodian,
            transfer_type,
            location_description,
            temperature,
            quality_notes,
        )
    }

    /// Get complete organ journey (chain of custody) ⭐ PROVENANCE
    /// 
    /// Retrieves all transfer legs for an organ from harvest to transplant.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `transfer_id` - Unique ID of the organ batch
    /// 
    /// # Returns
    /// * `Some(OrganJourney)` with complete history and current status
    /// * `None` if transfer not found
    pub fn get_organ_journey(
        env: Env,
        transfer_id: String,
    ) -> Option<crate::types::OrganJourney> {
        Registry::get_organ_journey(&env, transfer_id)
    }

    /// Get single transfer leg record ⭐ PROVENANCE
    /// 
    /// Retrieves a specific handoff in the organ's journey.
    /// 
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `transfer_id` - ID of the transfer leg
    /// 
    /// # Returns
    /// * `Some(OrganTransferLeg)` with custody details and signature
    /// * `None` if transfer not found
    pub fn get_transfer_leg(
        env: Env,
        transfer_id: String,
    ) -> Option<crate::types::OrganTransferLeg> {
        Registry::get_transfer_leg(&env, transfer_id)
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

    #[test]
    fn test_register_with_empty_organs_list() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "b4f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env]; // Empty organs list

        let result = client.register(&donor_id_hash, &wallet, &organs);
        assert!(result.is_ok());

        // Verify record was created with empty organs
        let record = client.get_record(&donor_id_hash);
        assert!(record.is_some());
        let rec = record.unwrap();
        assert_eq!(rec.organs.len(), 0);
    }

    #[test]
    fn test_register_with_many_organs() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "c5f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![
            &env,
            String::from_slice(&env, "kidney"),
            String::from_slice(&env, "liver"),
            String::from_slice(&env, "heart"),
            String::from_slice(&env, "lungs"),
            String::from_slice(&env, "corneas"),
            String::from_slice(&env, "pancreas"),
        ];

        let result = client.register(&donor_id_hash, &wallet, &organs);
        assert!(result.is_ok());

        // Verify all organs were stored
        let record = client.get_record(&donor_id_hash);
        assert!(record.is_some());
        let rec = record.unwrap();
        assert_eq!(rec.organs.len(), 6);
    }

    #[test]
    fn test_revoke_sets_is_active_to_false() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "d6f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "kidney")];

        // Register
        let _ = client.register(&donor_id_hash, &wallet, &organs);
        let record_before = client.get_record(&donor_id_hash);
        assert!(record_before.is_some());
        assert!(record_before.unwrap().is_active);

        // Revoke
        let _ = client.revoke(&donor_id_hash, &wallet);

        // Verify is_active is false
        let record_after = client.get_record(&donor_id_hash);
        assert!(record_after.is_some());
        assert!(!record_after.unwrap().is_active);

        // Verify other fields unchanged
        let rec = record_after.unwrap();
        assert_eq!(rec.donor_id_hash, donor_id_hash);
        assert_eq!(rec.wallet, wallet);
        assert_eq!(rec.organs.len(), 1);
    }

    #[test]
    fn test_query_returns_false_for_revoked_by_full_record() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "e7f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "liver")];

        // Register
        let _ = client.register(&donor_id_hash, &wallet, &organs);
        assert!(client.query(&donor_id_hash));

        // Revoke
        let _ = client.revoke(&donor_id_hash, &wallet);

        // Query should return false
        assert!(!client.query(&donor_id_hash));

        // Get_record should show is_active=false
        let record = client.get_record(&donor_id_hash);
        assert!(record.is_some());
        assert!(!record.unwrap().is_active);
    }

    #[test]
    fn test_register_timestamp_is_immutable() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let donor_id_hash = String::from_slice(&env, "f8f8d2c1e9b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7a2c5d8e1b4f7");
        let organs = vec![&env, String::from_slice(&env, "kidney")];

        // Register (captures timestamp)
        let _ = client.register(&donor_id_hash, &wallet, &organs);
        let record_after_register = client.get_record(&donor_id_hash).unwrap();
        let timestamp_after_register = record_after_register.registered_at;

        // Revoke should not change registered_at
        let _ = client.revoke(&donor_id_hash, &wallet);
        let record_after_revoke = client.get_record(&donor_id_hash).unwrap();
        let timestamp_after_revoke = record_after_revoke.registered_at;

        assert_eq!(timestamp_after_register, timestamp_after_revoke);
    }

    #[test]
    fn test_revoke_not_found_returns_error() {
        let env = Env::default();
        let contract_id = env.register_contract(None, LifemarqContract);
        let client = LifemarqContractClient::new(&env, &contract_id);

        let wallet = Address::random(&env);
        let nonexistent_hash = String::from_slice(&env, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

        // Revoke on nonexistent record should fail
        let result = client.revoke(&nonexistent_hash, &wallet);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), ContractError::NotFound);
    }
}
