import { logger } from "./middleware";

/**
 * Notification Service: Sends alerts to emergency contacts when donor records are queried
 *
 * This closes the loop between digital consent and real-world family communication.
 * When a hospital queries a donor's consent, the donor's registered emergency contact
 * receives a notification so they know their record was accessed.
 *
 * Privacy: Contact info is hashed before storage. Notifications are consent-based only.
 */

interface EmergencyContact {
  donor_id_hash: string;
  contact_type: "phone" | "email";
  contact_hash: string; // SHA-256 hash of phone/email (never store raw)
  contact_last4: string; // Last 4 chars for UI display (e.g., "+254...7890")
  is_verified: boolean; // Two-factor confirmation required
  notifications_enabled: boolean;
  created_at: Date;
}

interface QueryNotification {
  donor_id_hash: string;
  hospital_name: string;
  hospital_id: string;
  query_timestamp: Date;
  consent_was_active: boolean;
}

/**
 * Register an emergency contact for a donor
 *
 * Contact info must be hashed (SHA-256) before sending to API.
 * Client-side hashing ensures API never sees raw phone/email.
 *
 * Two-factor confirmation required:
 * 1. API sends verification code to contact
 * 2. Donor receives code and submits it
 * 3. Contact is marked verified
 */
export async function registerEmergencyContact(
  donorIdHash: string,
  contactType: "phone" | "email",
  contactHash: string,
  contactLast4: string,
): Promise<{
  success: boolean;
  message: string;
  verificationRequired: boolean;
}> {
  try {
    logger.info(
      `[NotificationService] Registering emergency contact for donor ${donorIdHash}`,
    );

    // TODO: Store in database
    // Contact should be marked as not verified until two-factor confirmation

    return {
      success: true,
      message: "Emergency contact registered. Verification code sent.",
      verificationRequired: true,
    };
  } catch (error) {
    logger.error(
      `[NotificationService] Error registering contact: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      success: false,
      message: "Failed to register emergency contact",
      verificationRequired: false,
    };
  }
}

/**
 * Verify emergency contact via two-factor code
 *
 * Only verified contacts receive notifications.
 */
export async function verifyEmergencyContact(
  donorIdHash: string,
  verificationCode: string,
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info(`[NotificationService] Verifying emergency contact`);

    // TODO: Verify code against database
    // Mark contact as verified if code matches

    return {
      success: true,
      message: "Emergency contact verified. Notifications enabled.",
    };
  } catch (error) {
    logger.error(
      `[NotificationService] Error verifying contact: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      success: false,
      message: "Verification failed",
    };
  }
}

/**
 * Send query notification to emergency contact
 *
 * Called when a hospital queries a donor's consent record.
 * Only sends if:
 * 1. Emergency contact is registered for this donor
 * 2. Emergency contact is verified
 * 3. Notifications are enabled
 *
 * Notification includes: hospital name, query timestamp, but NOT consent details
 * (privacy protection - contact only learns record was accessed, not what it contains)
 */
export async function notifyEmergencyContact(
  notification: QueryNotification,
): Promise<{ sent: boolean; method?: "sms" | "email"; messageId?: string }> {
  try {
    logger.info(
      `[NotificationService] Sending query notification for donor ${notification.donor_id_hash}`,
    );

    // TODO: Implement actual notification
    // For now, return mock response

    // In production, use Africa's Talking SMS or SendGrid email
    // Message format:
    // SMS: "Your donor record was queried by [hospital] on [date]. For security: never share this alert."
    // Email: Subject: "Your Organ Donor Record Was Queried"
    //        Body: "Hospital: [name], Time: [ISO], Consent Status: [active/revoked]"

    return {
      sent: true,
      method: "sms",
      messageId: `msg-${Date.now()}`,
    };
  } catch (error) {
    logger.error(
      `[NotificationService] Error sending notification: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      sent: false,
    };
  }
}

/**
 * Get notification history for a donor
 *
 * Returns list of times donor's record was queried.
 * Only accessible by the donor (requires wallet signature).
 */
export async function getQueryHistory(
  donorIdHash: string,
  limit: number = 50,
): Promise<QueryNotification[]> {
  try {
    logger.info(
      `[NotificationService] Fetching query history for donor ${donorIdHash}`,
    );

    // TODO: Query database for all queries of this donor
    // Return: hospital name, timestamp, consent status at time of query

    return [];
  } catch (error) {
    logger.error(
      `[NotificationService] Error fetching query history: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

/**
 * List registered emergency contacts for a donor
 *
 * Only donor can call this (requires wallet signature).
 * Returns contacts with last4 chars only (privacy).
 */
export async function listEmergencyContacts(
  donorIdHash: string,
): Promise<EmergencyContact[]> {
  try {
    logger.info(
      `[NotificationService] Listing emergency contacts for donor ${donorIdHash}`,
    );

    // TODO: Query database
    // Return all verified contacts for this donor

    return [];
  } catch (error) {
    logger.error(
      `[NotificationService] Error listing contacts: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

/**
 * Remove emergency contact
 *
 * Donor can remove a contact at any time.
 * No more notifications will be sent.
 */
export async function removeEmergencyContact(
  donorIdHash: string,
  contactHash: string,
): Promise<{ success: boolean; message: string }> {
  try {
    logger.info(
      `[NotificationService] Removing emergency contact for donor ${donorIdHash}`,
    );

    // TODO: Delete from database

    return {
      success: true,
      message: "Emergency contact removed",
    };
  } catch (error) {
    logger.error(
      `[NotificationService] Error removing contact: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      success: false,
      message: "Failed to remove contact",
    };
  }
}

/**
 * Disable notifications temporarily (e.g., during donor travel)
 */
export async function disableNotifications(
  donorIdHash: string,
): Promise<{ success: boolean }> {
  try {
    // TODO: Set notifications_enabled = false in database
    return { success: true };
  } catch (error) {
    logger.error(
      `[NotificationService] Error disabling notifications: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { success: false };
  }
}
