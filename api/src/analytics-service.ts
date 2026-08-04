/**
 * Analytics Service for Lifemarq
 *
 * Aggregates consent and verification metrics for ministry/government dashboards
 * Provides insights into:
 * - Donor registration trends
 * - Organ preference distribution
 * - Hospital verification volume
 * - System performance metrics
 *
 * This data helps governments understand organ supply/demand dynamics
 * and make data-driven public health policy decisions
 */

export interface DonorMetrics {
  totalRegistered: number;
  registeredToday: number;
  registeredThisMonth: number;
  registeredThisYear: number;
}

export interface OrganDistribution {
  [organ: string]: {
    count: number;
    percentage: number;
  };
}

export interface HospitalMetrics {
  totalQueries: number;
  queriesToday: number;
  queriesThisMonth: number;
  verifiedConsentCount: number;
  notVerifiedCount: number;
  errorCount: number;
}

export interface VerificationTrend {
  timestamp: string;
  hour: number;
  verifications: number;
  consentActive: number;
  consentInactive: number;
}

export interface AnalyticsData {
  donors: DonorMetrics;
  organDistribution: OrganDistribution;
  hospitals: HospitalMetrics;
  verificationTrends: VerificationTrend[];
  systemHealth: {
    apiResponseTimeMs: number;
    contractQueryTimeMs: number;
    uptime: number;
  };
}

export class AnalyticsService {
  private donorRegistrations: Array<{
    timestamp: number;
    idHash: string;
    organs: string[];
  }> = [];

  private verifications: Array<{
    timestamp: number;
    hospitalId: string;
    status: "verified" | "not_verified" | "error";
    organs: string[];
  }> = [];

  private startTime = Date.now();

  /**
   * Record a donor registration for analytics
   */
  recordDonorRegistration(idHash: string, organs: string[]): void {
    this.donorRegistrations.push({
      timestamp: Date.now(),
      idHash,
      organs,
    });
  }

  /**
   * Record a hospital verification for analytics
   */
  recordVerification(
    hospitalId: string,
    status: "verified" | "not_verified" | "error",
    organs: string[] = [],
  ): void {
    this.verifications.push({
      timestamp: Date.now(),
      hospitalId,
      status,
      organs,
    });
  }

  /**
   * Get donor registration metrics
   */
  getDonorMetrics(): DonorMetrics {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthTime = startOfMonth.getTime();

    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);
    startOfYear.setHours(0, 0, 0, 0);
    const startOfYearTime = startOfYear.getTime();

    const registeredToday = this.donorRegistrations.filter(
      (r) => r.timestamp >= startOfToday,
    ).length;

    const registeredThisMonth = this.donorRegistrations.filter(
      (r) => r.timestamp >= startOfMonthTime,
    ).length;

    const registeredThisYear = this.donorRegistrations.filter(
      (r) => r.timestamp >= startOfYearTime,
    ).length;

    return {
      totalRegistered: this.donorRegistrations.length,
      registeredToday,
      registeredThisMonth,
      registeredThisYear,
    };
  }

  /**
   * Get organ distribution (what % of donors consent to each organ)
   */
  getOrganDistribution(): OrganDistribution {
    const organCounts: Record<string, number> = {};
    const total = Math.max(this.donorRegistrations.length, 1); // Avoid division by zero

    // Count organ mentions
    for (const registration of this.donorRegistrations) {
      for (const organ of registration.organs) {
        organCounts[organ] = (organCounts[organ] || 0) + 1;
      }
    }

    // Convert to distribution
    const distribution: OrganDistribution = {};
    for (const [organ, count] of Object.entries(organCounts)) {
      distribution[organ] = {
        count,
        percentage: Math.round((count / total) * 100),
      };
    }

    return distribution;
  }

  /**
   * Get hospital verification metrics
   */
  getHospitalMetrics(): HospitalMetrics {
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfToday = today.getTime();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthTime = startOfMonth.getTime();

    const verifiedConsentCount = this.verifications.filter(
      (v) => v.status === "verified",
    ).length;

    const notVerifiedCount = this.verifications.filter(
      (v) => v.status === "not_verified",
    ).length;

    const errorCount = this.verifications.filter(
      (v) => v.status === "error",
    ).length;

    const queriesToday = this.verifications.filter(
      (v) => v.timestamp >= startOfToday,
    ).length;

    const queriesThisMonth = this.verifications.filter(
      (v) => v.timestamp >= startOfMonthTime,
    ).length;

    return {
      totalQueries: this.verifications.length,
      queriesToday,
      queriesThisMonth,
      verifiedConsentCount,
      notVerifiedCount,
      errorCount,
    };
  }

  /**
   * Get verification trends over time
   */
  getVerificationTrends(): VerificationTrend[] {
    const trends: Map<number, VerificationTrend> = new Map();

    for (const verification of this.verifications) {
      const date = new Date(verification.timestamp);
      const hour = Math.floor(verification.timestamp / (60 * 60 * 1000)); // Group by hour
      const hourKey = hour;

      if (!trends.has(hourKey)) {
        trends.set(hourKey, {
          timestamp: date.toISOString(),
          hour: date.getHours(),
          verifications: 0,
          consentActive: 0,
          consentInactive: 0,
        });
      }

      const trend = trends.get(hourKey)!;
      trend.verifications++;

      if (verification.status === "verified") {
        trend.consentActive++;
      } else if (verification.status === "not_verified") {
        trend.consentInactive++;
      }
    }

    // Convert to array and sort by timestamp
    return Array.from(trends.values())
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      )
      .slice(-24); // Last 24 hours
  }

  /**
   * Get comprehensive analytics data
   */
  getAnalytics(
    responseTimeMs: number = 50,
    contractTimeMs: number = 100,
  ): AnalyticsData {
    const uptime = ((Date.now() - this.startTime) / (1000 * 60)).toFixed(2); // In minutes

    return {
      donors: this.getDonorMetrics(),
      organDistribution: this.getOrganDistribution(),
      hospitals: this.getHospitalMetrics(),
      verificationTrends: this.getVerificationTrends(),
      systemHealth: {
        apiResponseTimeMs: responseTimeMs,
        contractQueryTimeMs: contractTimeMs,
        uptime: parseFloat(uptime),
      },
    };
  }

  /**
   * Clear all analytics (for testing)
   */
  clear(): void {
    this.donorRegistrations = [];
    this.verifications = [];
    this.startTime = Date.now();
  }

  /**
   * Get registration count for a specific time period
   */
  getRegistrationCount(startTime: Date, endTime: Date): number {
    const startMs = startTime.getTime();
    const endMs = endTime.getTime();

    return this.donorRegistrations.filter(
      (r) => r.timestamp >= startMs && r.timestamp <= endMs,
    ).length;
  }

  /**
   * Get verification count by hospital
   */
  getVerificationCountByHospital(hospitalId: string): number {
    return this.verifications.filter((v) => v.hospitalId === hospitalId).length;
  }

  /**
   * Get top hospitals by verification volume
   */
  getTopHospitals(limit: number = 10): Array<{
    hospitalId: string;
    verificationCount: number;
  }> {
    const hospitalCounts: Record<string, number> = {};

    for (const verification of this.verifications) {
      hospitalCounts[verification.hospitalId] =
        (hospitalCounts[verification.hospitalId] || 0) + 1;
    }

    return Object.entries(hospitalCounts)
      .map(([hospitalId, count]) => ({ hospitalId, verificationCount: count }))
      .sort((a, b) => b.verificationCount - a.verificationCount)
      .slice(0, limit);
  }
}
