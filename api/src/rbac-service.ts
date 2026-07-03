/**
 * Role-Based Access Control (RBAC) Service
 *
 * Manages three roles:
 * - HOSPITAL: Can verify consent, query records
 * - ADMIN: Full access to all endpoints and audit logs
 * - DONOR: Can check own consent status (future: verify with wallet)
 *
 * Authorization is enforced via API key or wallet signature.
 */

export enum Role {
  HOSPITAL = "hospital",
  ADMIN = "admin",
  DONOR = "donor",
  PUBLIC = "public", // No authentication required
}

export interface AuthenticatedUser {
  role: Role;
  identifier: string; // Hospital ID, admin ID, or donor wallet
  permissions: string[];
}

export interface RolePermissions {
  [key: string]: string[];
}

/**
 * Default permissions per role
 */
const ROLE_PERMISSIONS: RolePermissions = {
  [Role.HOSPITAL]: [
    "verify_donor",
    "query_consent",
    "view_own_verification_history",
  ],
  [Role.ADMIN]: [
    "verify_donor",
    "query_consent",
    "query_consent_full",
    "view_audit_logs",
    "view_all_verification_history",
    "manage_api_keys",
  ],
  [Role.DONOR]: ["check_own_consent", "revoke_own_consent"],
  [Role.PUBLIC]: ["check_consent_status"],
};

/**
 * RBAC Service
 *
 * Manages user roles and permissions
 */
export class RbacService {
  /// In-memory API key store (Hospital → API Key mapping)
  /// Production: Load from database/secrets manager
  private apiKeyStore: Map<string, { hospitalId: string; role: Role }> =
    new Map([
      [
        "sk_test_hospital_001",
        { hospitalId: "hospital-001", role: Role.HOSPITAL },
      ],
      [
        "sk_test_hospital_002",
        { hospitalId: "hospital-002", role: Role.HOSPITAL },
      ],
      ["sk_test_admin", { hospitalId: "admin", role: Role.ADMIN }],
    ]);

  /**
   * Authenticate user via API key
   *
   * @param apiKey - API key from Authorization header
   * @returns AuthenticatedUser with role and permissions
   * @throws RbacError if API key invalid
   */
  authenticateWithApiKey(apiKey: string): AuthenticatedUser {
    if (!apiKey) {
      throw new RbacError("Missing API key", "MISSING_API_KEY");
    }

    const keyData = this.apiKeyStore.get(apiKey);
    if (!keyData) {
      throw new RbacError("Invalid API key", "INVALID_API_KEY");
    }

    return {
      role: keyData.role,
      identifier: keyData.hospitalId,
      permissions: ROLE_PERMISSIONS[keyData.role] || [],
    };
  }

  /**
   * Authenticate public user (no API key)
   *
   * Returns public role with limited permissions
   */
  authenticatePublic(): AuthenticatedUser {
    return {
      role: Role.PUBLIC,
      identifier: "anonymous",
      permissions: ROLE_PERMISSIONS[Role.PUBLIC] || [],
    };
  }

  /**
   * Check if user has permission
   *
   * @param user - Authenticated user
   * @param permission - Required permission
   * @returns true if user has permission
   */
  hasPermission(user: AuthenticatedUser, permission: string): boolean {
    return user.permissions.includes(permission);
  }

  /**
   * Check if user has role
   *
   * @param user - Authenticated user
   * @param role - Required role
   * @returns true if user has role
   */
  hasRole(user: AuthenticatedUser, role: Role): boolean {
    return user.role === role;
  }

  /**
   * Authorize hospital to access record
   *
   * Hospital can only access their own verification history
   *
   * @param user - Authenticated user
   * @param targetHospitalId - Hospital ID being accessed
   * @returns true if authorized
   */
  authorizeHospitalAccess(
    user: AuthenticatedUser,
    targetHospitalId: string,
  ): boolean {
    // Admin can access any hospital's data
    if (user.role === Role.ADMIN) {
      return true;
    }

    // Hospital can only access own data
    if (user.role === Role.HOSPITAL) {
      return user.identifier === targetHospitalId;
    }

    return false;
  }

  /**
   * Add API key (for admin operations)
   *
   * @param apiKey - New API key
   * @param hospitalId - Hospital identifier
   * @param role - Role to assign
   */
  addApiKey(
    apiKey: string,
    hospitalId: string,
    role: Role = Role.HOSPITAL,
  ): void {
    this.apiKeyStore.set(apiKey, { hospitalId, role });
  }

  /**
   * Revoke API key (for admin operations)
   *
   * @param apiKey - API key to revoke
   * @returns true if key was revoked
   */
  revokeApiKey(apiKey: string): boolean {
    return this.apiKeyStore.delete(apiKey);
  }

  /**
   * Get API keys for hospital (for admin operations)
   *
   * Returns count of keys (never actual keys for security)
   */
  getApiKeyCount(hospitalId: string): number {
    let count = 0;
    for (const [, keyData] of this.apiKeyStore) {
      if (keyData.hospitalId === hospitalId) {
        count++;
      }
    }
    return count;
  }
}

/**
 * RBAC Error
 */
export class RbacError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "RbacError";
  }
}

/**
 * Global RBAC service instance
 */
export const rbacService = new RbacService();

/**
 * Express middleware for RBAC
 *
 * Extracts API key from Authorization header and authenticates user
 */
export function rbacMiddleware(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Public endpoints don't require authentication
      req.user = rbacService.authenticatePublic();
      return next();
    }

    const apiKey = authHeader.substring("Bearer ".length).trim();
    req.user = rbacService.authenticateWithApiKey(apiKey);
    next();
  } catch (error: any) {
    if (error instanceof RbacError) {
      console.warn(`[RBAC] Authentication failed: ${error.message}`);
      // Allow request to proceed; authorization check happens at endpoint
      req.user = rbacService.authenticatePublic();
      return next();
    }

    next(error);
  }
}

/**
 * Route guard: Require specific role
 *
 * Usage: app.get("/admin-endpoint", requireRole(Role.ADMIN), handler);
 */
export function requireRole(requiredRole: Role) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (req.user.role !== requiredRole && req.user.role !== Role.ADMIN) {
      return res.status(403).json({
        error: `Forbidden: requires ${requiredRole} role`,
      });
    }

    next();
  };
}

/**
 * Route guard: Require permission
 *
 * Usage: app.get("/endpoint", requirePermission("verify_donor"), handler);
 */
export function requirePermission(permission: string) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!rbacService.hasPermission(req.user, permission)) {
      return res.status(403).json({
        error: `Forbidden: requires ${permission} permission`,
      });
    }

    next();
  };
}
