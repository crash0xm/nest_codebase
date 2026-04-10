import { Injectable } from '@nestjs/common';
import { AppLoggerService, LogContext } from '@/common/services/logger.service';
//tesst
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
  duration?: number;
}

export interface PerformanceThreshold {
  name: string;
  warning: number;
  critical: number;
  unit: string;
  comparison: 'greater_than' | 'less_than' | 'equals';
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  thresholds: PerformanceThreshold[];
  summary: {
    totalMetrics: number;
    alerts: number;
    warnings: number;
    criticals: number;
  };
  generatedAt: string;
}

export interface PerformanceAlert {
  metric: string;
  value: number;
  threshold: PerformanceThreshold;
  severity: 'warning' | 'critical';
  timestamp: number;
  message: string;
}

@Injectable()
export class PerformanceService {
  private readonly metrics: PerformanceMetric[] = [];
  private readonly thresholds = new Map<string, PerformanceThreshold>();
  private readonly alerts: PerformanceAlert[] = [];
  private readonly timers = new Map<string, number>();

  constructor(private readonly logger: AppLoggerService) {
    this.initializeDefaultThresholds();
  }

  // Metric recording
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    };

    this.metrics.push(metric);

    // Keep only last 10000 metrics to prevent memory issues
    if (this.metrics.length > 10000) {
      this.metrics.splice(0, this.metrics.length - 10000);
    }

    this.logger.trace(`Performance metric recorded: ${name}`, LogContext.PERFORMANCE, {
      metric: name,
      value,
      unit,
      tags,
    });

    // Check thresholds
    this.checkThresholds(metric);
  }

  recordDuration(name: string, duration: number, tags?: Record<string, string>): void {
    this.recordMetric(name, duration, 'ms', tags);
  }

  recordMemoryUsage(name: string, memoryUsage: number, tags?: Record<string, string>): void {
    this.recordMetric(name, memoryUsage, 'bytes', tags);
  }

  recordCpuUsage(name: string, cpuUsage: number, tags?: Record<string, string>): void {
    this.recordMetric(name, cpuUsage, 'percent', tags);
  }

  recordDatabaseQuery(
    name: string,
    duration: number,
    rowCount?: number,
    tags?: Record<string, string>,
  ): void {
    this.recordMetric(name, duration, 'ms', {
      ...tags,
      ...(rowCount !== undefined && { rowCount: rowCount.toString() }),
    });
  }

  recordApiResponse(
    name: string,
    duration: number,
    statusCode: number,
    tags?: Record<string, string>,
  ): void {
    this.recordMetric(name, duration, 'ms', {
      ...tags,
      statusCode: statusCode.toString(),
    });
  }

  // Timer utilities
  startTimer(name: string): () => void {
    const startTime = Date.now();
    this.timers.set(name, startTime);

    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      this.timers.delete(name);

      this.recordDuration(name, duration);
    };
  }

  endTimer(name: string): number | null {
    const startTime = this.timers.get(name);
    if (!startTime) {
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    this.timers.delete(name);

    this.recordDuration(name, duration);
    return duration;
  }

  // Threshold management
  addThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.set(threshold.name, threshold);

    this.logger.trace(`Performance threshold added: ${threshold.name}`, LogContext.PERFORMANCE, {
      threshold: threshold.name,
      warning: threshold.warning,
      critical: threshold.critical,
      unit: threshold.unit,
    });
  }

  removeThreshold(name: string): boolean {
    const removed = this.thresholds.delete(name);

    if (removed) {
      this.logger.trace(`Performance threshold removed: ${name}`, LogContext.PERFORMANCE, {
        threshold: name,
      });
    }

    return removed;
  }

  // Alert management
  getActiveAlerts(): PerformanceAlert[] {
    const now = Date.now();
    const alertTtl = 5 * 60 * 1000; // 5 minutes

    return this.alerts.filter((alert) => now - alert.timestamp < alertTtl);
  }

  clearAlerts(): void {
    const clearedCount = this.alerts.length;
    this.alerts.splice(0, this.alerts.length);

    this.logger.trace(`Performance alerts cleared`, LogContext.PERFORMANCE, {
      clearedCount,
    });
  }

  // Reporting
  generateReport(timeRange?: { start: number; end: number }): PerformanceReport {
    let filteredMetrics = this.metrics;

    if (timeRange) {
      filteredMetrics = this.metrics.filter(
        (metric) => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end,
      );
    }

    const thresholdArray = Array.from(this.thresholds.values());
    const activeAlerts = this.getActiveAlerts();

    const warnings = activeAlerts.filter((alert) => alert.severity === 'warning').length;
    const criticals = activeAlerts.filter((alert) => alert.severity === 'critical').length;

    return {
      metrics: filteredMetrics,
      thresholds: thresholdArray,
      summary: {
        totalMetrics: filteredMetrics.length,
        alerts: activeAlerts.length,
        warnings,
        criticals,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  getMetricsByName(name: string, timeRange?: { start: number; end: number }): PerformanceMetric[] {
    let filteredMetrics = this.metrics.filter((metric) => metric.name === name);

    if (timeRange) {
      filteredMetrics = filteredMetrics.filter(
        (metric) => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end,
      );
    }

    return filteredMetrics;
  }

  getMetricsByTag(tagKey: string, tagValue: string): PerformanceMetric[] {
    return this.metrics.filter((metric) => metric.tags?.[tagKey] === tagValue);
  }

  // Statistics
  getAverageMetric(name: string, timeRange?: { start: number; end: number }): number | null {
    const metrics = this.getMetricsByName(name, timeRange);

    if (metrics.length === 0) {
      return null;
    }

    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  getMaxMetric(name: string, timeRange?: { start: number; end: number }): number | null {
    const metrics = this.getMetricsByName(name, timeRange);

    if (metrics.length === 0) {
      return null;
    }

    return Math.max(...metrics.map((metric) => metric.value));
  }

  getMinMetric(name: string, timeRange?: { start: number; end: number }): number | null {
    const metrics = this.getMetricsByName(name, timeRange);

    if (metrics.length === 0) {
      return null;
    }

    return Math.min(...metrics.map((metric) => metric.value));
  }

  getPercentileMetric(
    name: string,
    percentile: number,
    timeRange?: { start: number; end: number },
  ): number | null {
    const metrics = this.getMetricsByName(name, timeRange);

    if (metrics.length === 0) {
      return null;
    }

    const sortedMetrics = metrics.map((metric) => metric.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sortedMetrics.length) - 1;

    return sortedMetrics[Math.max(0, index)];
  }

  // Health check
  healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: {
      totalMetrics: number;
      activeAlerts: number;
      memoryUsage: number;
    };
  }> {
    const issues: string[] = [];
    const activeAlerts = this.getActiveAlerts();

    // Check for too many critical alerts
    const criticalAlerts = activeAlerts.filter((alert) => alert.severity === 'critical');
    if (criticalAlerts.length > 5) {
      issues.push('Too many critical performance alerts');
    }

    // Check for old metrics (stale data)
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    const staleMetrics = this.metrics.filter((metric) => now - metric.timestamp > staleThreshold);

    if (staleMetrics.length > this.metrics.length * 0.8) {
      issues.push('Most performance metrics are stale');
    }

    return Promise.resolve({
      healthy: issues.length === 0,
      issues,
      metrics: {
        totalMetrics: this.metrics.length,
        activeAlerts: activeAlerts.length,
        memoryUsage: this.calculateMemoryUsage(),
      },
    });
  }

  // Cleanup
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): number {
    // 24 hours default
    const cutoff = Date.now() - maxAge;
    const initialLength = this.metrics.length;

    this.metrics.splice(
      0,
      this.metrics.length,
      ...this.metrics.filter((metric) => metric.timestamp > cutoff),
    );

    const cleanedCount = initialLength - this.metrics.length;

    this.logger.trace(`Performance metrics cleanup completed`, LogContext.PERFORMANCE, {
      operation: 'cleanup',
      cleanedCount,
      remainingMetrics: this.metrics.length,
      maxAge,
    });

    return cleanedCount;
  }

  private initializeDefaultThresholds(): void {
    // Response time thresholds
    this.addThreshold({
      name: 'api_response_time',
      warning: 500, // 500ms
      critical: 2000, // 2s
      unit: 'ms',
      comparison: 'greater_than',
    });

    // Database query thresholds
    this.addThreshold({
      name: 'database_query_time',
      warning: 100, // 100ms
      critical: 1000, // 1s
      unit: 'ms',
      comparison: 'greater_than',
    });

    // Memory usage thresholds
    this.addThreshold({
      name: 'memory_usage',
      warning: 100 * 1024 * 1024, // 100MB
      critical: 500 * 1024 * 1024, // 500MB
      unit: 'bytes',
      comparison: 'greater_than',
    });

    // CPU usage thresholds
    this.addThreshold({
      name: 'cpu_usage',
      warning: 70, // 70%
      critical: 90, // 90%
      unit: 'percent',
      comparison: 'greater_than',
    });

    // Error rate thresholds
    this.addThreshold({
      name: 'error_rate',
      warning: 5, // 5%
      critical: 15, // 15%
      unit: 'percent',
      comparison: 'greater_than',
    });
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name);

    if (!threshold) {
      return;
    }

    let isAlert = false;
    let severity: 'warning' | 'critical' | null = null;

    switch (threshold.comparison) {
      case 'greater_than':
        if (metric.value > threshold.critical) {
          isAlert = true;
          severity = 'critical';
        } else if (metric.value > threshold.warning) {
          isAlert = true;
          severity = 'warning';
        }
        break;
      case 'less_than':
        if (metric.value < threshold.critical) {
          isAlert = true;
          severity = 'critical';
        } else if (metric.value < threshold.warning) {
          isAlert = true;
          severity = 'warning';
        }
        break;
      case 'equals':
        if (metric.value === threshold.critical) {
          isAlert = true;
          severity = 'critical';
        } else if (metric.value === threshold.warning) {
          isAlert = true;
          severity = 'warning';
        }
        break;
    }

    if (isAlert && severity) {
      const alert: PerformanceAlert = {
        metric: metric.name,
        value: metric.value,
        threshold,
        severity,
        timestamp: metric.timestamp,
        message: `${metric.name} is ${severity}: ${metric.value}${threshold.unit} (threshold: ${severity === 'critical' ? threshold.critical : threshold.warning}${threshold.unit})`,
      };

      this.alerts.push(alert);

      // Keep only last 1000 alerts
      if (this.alerts.length > 1000) {
        this.alerts.splice(0, this.alerts.length - 1000);
      }

      this.logger.security(`Performance alert: ${severity}`, {
        alert: alert.message,
        metric: metric.name,
        value: metric.value,
        threshold: severity === 'critical' ? threshold.critical : threshold.warning,
        unit: threshold.unit,
        tags: metric.tags,
      });
    }
  }

  private calculateMemoryUsage(): number {
    // Rough estimation of memory usage
    let totalSize = 0;

    totalSize += JSON.stringify(this.metrics).length * 2;
    totalSize += JSON.stringify(Array.from(this.thresholds.entries())).length * 2;
    totalSize += JSON.stringify(this.alerts).length * 2;
    totalSize += JSON.stringify(Array.from(this.timers.entries())).length * 2;

    return totalSize;
  }
}

// Performance monitoring decorator
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/explicit-module-boundary-types */
export const PerformanceMonitor =
  (_metricName: string) =>
  (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<unknown> {
      const performanceService = (this as any).performanceService as PerformanceService;

      if (!performanceService) {
        return originalMethod.apply(this, args);
      }

      const timer = performanceService.startTimer(`${target.constructor.name}:${propertyKey}`);

      try {
        const result = await originalMethod.apply(this, args);
        timer();
        return result;
      } catch (error) {
        timer();
        throw error;
      }
    };

    return descriptor;
  };
