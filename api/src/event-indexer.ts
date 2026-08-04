import { Env, SorobanRpc } from "@stellar/stellar-sdk";
import { logger } from "./middleware";

/**
 * Event Indexer: Background worker that polls Soroban RPC for contract events
 * and stores them in the database for audit trail, analytics, and queries.
 *
 * This enables:
 * - GET /events endpoint that shows real on-chain activity
 * - Audit history that survives beyond a single API session
 * - Ministry dashboard analytics with real data
 * - Proof of network activity (transaction counts, consent registrations)
 */

interface IndexedEvent {
  id: string;
  contract_id: string;
  event_type: "register" | "revoke" | "recipient" | "hospital_verified";
  tx_hash: string;
  ledger_sequence: number;
  timestamp: number;
  data: Record<string, unknown>;
  created_at: Date;
}

/**
 * Poll Soroban RPC for new contract events
 * Filters for:
 * - "lifemarq.register" - donor consent registration
 * - "lifemarq.revoke" - donor revocation
 * - "lifemarq.recipient" - recipient waitlist registration
 * - "lifemarq.hospital_verified" - hospital verification
 */
export async function indexContractEvents(
  contractId: string,
  sorobanRpc: SorobanRpc.Server,
  fromLedger?: number,
): Promise<IndexedEvent[]> {
  try {
    logger.info(`[EventIndexer] Polling for contract events: ${contractId}`);

    // Query events from Soroban RPC
    // This will be called on a schedule (e.g., every 30 seconds)
    // to keep the event log fresh
    const events = await sorobanRpc.getEvents({
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
        },
      ],
      startLedger: fromLedger || 0,
      limit: 100,
    });

    if (!events.events || events.events.length === 0) {
      logger.info(`[EventIndexer] No new events found`);
      return [];
    }

    logger.info(
      `[EventIndexer] Found ${events.events.length} new contract events`,
    );

    const indexedEvents: IndexedEvent[] = events.events
      .map((event) => {
        const topics = (event.topic || []) as string[];
        const eventTypeRaw = topics[topics.length - 1] || "";

        // Determine event type from topic
        let eventType: IndexedEvent["event_type"] = "register";
        if (eventTypeRaw.includes("revoke")) eventType = "revoke";
        else if (eventTypeRaw.includes("recipient")) eventType = "recipient";
        else if (eventTypeRaw.includes("hospital"))
          eventType = "hospital_verified";

        return {
          id: `${event.pagingToken}`,
          contract_id: contractId,
          event_type: eventType,
          tx_hash: event.txHash || "",
          ledger_sequence: event.ledger || 0,
          timestamp: Date.now() / 1000,
          data: parseEventData(event.value?.xdr || ""),
          created_at: new Date(),
        };
      })
      .filter((e) => e !== null);

    logger.info(`[EventIndexer] Indexed ${indexedEvents.length} events`);
    return indexedEvents;
  } catch (error) {
    logger.error(
      `[EventIndexer] Error polling for events: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

/**
 * Parse XDR event data into human-readable format
 * This is a simplified parser — production should use soroban-sdk's XDR utilities
 */
function parseEventData(xdrData: string): Record<string, unknown> {
  try {
    // In production, use @stellar/stellar-sdk XDR parser
    // For now, return a placeholder structure that shows the data exists
    return {
      xdr: xdrData.substring(0, 50) + "...",
      decoded: {
        // Event structure will vary by event type
        // This is a template that will be filled by actual XDR decoding
      },
    };
  } catch (error) {
    logger.error(
      `[EventIndexer] Error parsing event data: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { error: "Failed to parse event data" };
  }
}

/**
 * Start continuous event indexing
 * Polls Soroban RPC every 30 seconds and stores new events
 */
export function startEventIndexer(
  contractId: string,
  sorobanRpc: SorobanRpc.Server,
  storageCallback?: (events: IndexedEvent[]) => Promise<void>,
): NodeJS.Timer {
  let lastLedger = 0;

  const interval = setInterval(async () => {
    try {
      const newEvents = await indexContractEvents(
        contractId,
        sorobanRpc,
        lastLedger,
      );

      if (newEvents.length > 0) {
        lastLedger = Math.max(
          lastLedger,
          ...newEvents.map((e) => e.ledger_sequence),
        );

        if (storageCallback) {
          await storageCallback(newEvents);
        }
      }
    } catch (error) {
      logger.error(
        `[EventIndexer] Indexing cycle failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, 30 * 1000); // Poll every 30 seconds

  logger.info(
    `[EventIndexer] Background indexing started for contract: ${contractId}`,
  );
  return interval;
}

/**
 * Get all indexed events (used by GET /events endpoint)
 * In production, this queries a database (PostgreSQL, Supabase, etc.)
 */
export async function getIndexedEvents(
  contractId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<{ events: IndexedEvent[]; total: number }> {
  // TODO: Implement database query
  // For now, return empty array
  // This will be populated by the indexer writing to PostgreSQL
  return {
    events: [],
    total: 0,
  };
}

/**
 * Get event statistics for ministry dashboard
 * Returns counts of registrations, revocations, recipients waiting, etc.
 */
export async function getEventStats(contractId: string) {
  // TODO: Implement aggregation queries
  return {
    total_registrations: 0,
    total_revocations: 0,
    active_consents: 0,
    recipients_waiting: 0,
    hospitals_verified: 0,
    last_indexing_time: null,
  };
}
