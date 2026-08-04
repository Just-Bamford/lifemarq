use soroban_sdk::{Address, Env, String, Vec, symbol_short};
use crate::types::{ConsentRecord, DataKey, ContractError};

/// Core registry logic for Lifemarq
/// 
/// Enforces consent immutability and state machine transitions:
/// - Registration: (new) → ACTIVE
/// - Revocation: ACTIVE → REVOKED (irreversible, final)
/// 
/// All transitions require explicit wallet authentication
/// All state changes emit auditable events
pub struct Registry;

impl Registry {
    /// Register a new donor consent record
    /// 
    /// State transition: (new) → ACTIVE
    /// Preconditions:
    ///   - No record exists for this donor_id_hash
    ///   - Caller wallet must authenticate (wallet.require_auth())
    /// Postconditions:
    ///   - ConsentRecord stored with is_active=true, current timestamp
    ///   - DonorRegistered event emitted
    /// Idempotency: Returns AlreadyRegistered on duplicate hash
    pub fn register(
        env: &Env,
        donor_id_hash: String,
        wallet: Address,
        organs: Vec<String>,
    ) -> Result<(), ContractError> {
        // SECURITY: Require wallet signature FIRST (before any state checks)
        wallet.require_auth();

        // IDEMPOTENCY CHECK: Verify no record exists
        if env
            .storage()
            .persistent()
            .has(&DataKey::Consent(donor_id_hash.clone()))
        {
            return Err(ContractError::AlreadyRegistered);
        }

        // STATE TRANSITION: Create new consent record in ACTIVE state
        let record = ConsentRecord {
            donor_id_hash: donor_id_hash.clone(),
            wallet: wallet.clone(),
            organs,
            registered_at: env.ledger().timestamp(),
            is_active: true, // ACTIVE state
        };

        // PERSISTENCE: Write to ledger (immutable once committed)
        env.storage()
            .persistent()
            .set(&DataKey::Consent(donor_id_hash.clone()), &record);

        // AUDITABILITY: Emit event for blockchain observers
        env.events().publish(
            (symbol_short!("lifemarq"), symbol_short!("register")),
            (donor_id_hash.clone(), &wallet, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Revoke a donor's consent (irreversible transition to REVOKED state)
    /// 
    /// State transition: ACTIVE → REVOKED
    /// Preconditions:
    ///   - Record exists (NotFound if missing)
    ///   - Record is ACTIVE (AlreadyRevoked if already revoked)
    ///   - Caller wallet matches original registrant (Unauthorized if mismatch)
    ///   - Caller wallet must authenticate (wallet.require_auth())
    /// Postconditions:
    ///   - record.is_active = false (irreversible)
    ///   - ConsentRevoked event emitted
    ///   - No re-activation possible (immutability enforced)
    pub fn revoke(
        env: &Env,
        donor_id_hash: String,
        wallet: Address,
    ) -> Result<(), ContractError> {
        // SECURITY: Require wallet signature FIRST
        wallet.require_auth();

        // STATE CHECK: Fetch existing record (must exist)
        let record = env
            .storage()
            .persistent()
            .get::<_, ConsentRecord>(&DataKey::Consent(donor_id_hash.clone()))
            .ok_or(ContractError::NotFound)?;

        // IMMUTABILITY CHECK: Prevent post-revocation mutations
        if !record.is_active {
            return Err(ContractError::AlreadyRevoked);
        }

        // AUTHORIZATION CHECK: Verify caller is original registrant
        if record.wallet != wallet {
            return Err(ContractError::Unauthorized);
        }

        // STATE TRANSITION: Update to REVOKED state
        let mut updated_record = record;
        updated_record.is_active = false; // REVOKED state (immutable, final)

        // PERSISTENCE: Write updated record (now inactive)
        // Note: Only is_active changes; all other fields remain unchanged
        env.storage()
            .persistent()
            .set(&DataKey::Consent(donor_id_hash.clone()), &updated_record);

        // AUDITABILITY: Emit event for blockchain observers
        env.events().publish(
            (symbol_short!("lifemarq"), symbol_short!("revoke")),
            (donor_id_hash.clone(), &wallet, env.ledger().timestamp()),
        );

        Ok(())
    }

    /// Query a donor's consent status (read-only, no auth required)
    /// 
    /// Returns true if:
    ///   - Record exists for donor_id_hash
    ///   - record.is_active == true
    /// 
    /// Returns false if:
    ///   - Record does not exist
    ///   - Record exists but is_active == false (revoked)
    /// 
    /// No events emitted (read-only query)
    pub fn query(env: &Env, donor_id_hash: String) -> bool {
        match env
            .storage()
            .persistent()
            .get::<_, ConsentRecord>(&DataKey::Consent(donor_id_hash.clone()))
        {
            Some(record) => record.is_active,
            None => false,
        }
    }

    /// Get full consent record (read-only, no auth required)
    /// 
    /// Returns Some(ConsentRecord) if found
    /// Returns None if not found or if donor_id_hash is invalid
    /// 
    /// Caller can then inspect record.is_active to determine consent state
    /// No events emitted (read-only query)
    pub fn get_record(env: &Env, donor_id_hash: String) -> Option<ConsentRecord> {
        env.storage()
            .persistent()
            .get::<_, ConsentRecord>(&DataKey::Consent(donor_id_hash))
    }

    /// Register a recipient on the organ transplant waitlist
    /// 
    /// Data capture only in v1 — no matching logic yet.
    /// Used to track demand alongside supply.
    pub fn register_recipient(
        env: &Env,
        recipient_id_hash: String,
        wallet: Address,
        needed_organs: Vec<String>,
        blood_type: String,
    ) -> Result<(), ContractError> {
        // SECURITY: Require wallet signature
        wallet.require_auth();

        // Emit registration event for audit trail
        env.events().publish(
            (symbol_short!("lifemarq"), symbol_short!("recipient")),
            (recipient_id_hash.clone(), wallet.clone()),
        );

        // In v1, we don't prevent duplicate waitlist entries (allow reregistration)
        // Production would implement proper waitlist management

        // For v1, store just the organ count as a counter
        for organ in needed_organs {
            // Increment counter for this organ
            let organ_key = DataKey::Recipient(organ);
            let current = env
                .storage()
                .persistent()
                .get::<_, u32>(&organ_key)
                .unwrap_or(0);
            env.storage()
                .persistent()
                .set(&organ_key, &(current + 1));
        }

        Ok(())
    }

    /// Get the number of recipients waiting for a specific organ
    pub fn get_recipient_count(env: &Env, organ: String) -> u32 {
        let key = DataKey::Recipient(organ);
        env.storage()
            .persistent()
            .get::<_, u32>(&key)
            .unwrap_or(0)
    }
}
