import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'node:path';
import { app } from 'electron';

// Get app data directory
const getLogPath = () => {
  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    // Fallback for testing
    return path.join(process.cwd(), 'logs');
  }
};

// Custom format for structured logging
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp', 'label'],
  }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss.SSS',
  }),
  winston.format.printf(({ timestamp, level, message, metadata }) => {
    const meta = metadata && Object.keys(metadata).length
      ? ` ${JSON.stringify(metadata)}`
      : '';
    return `${timestamp} ${level}: ${message}${meta}`;
  })
);

// Security events transport
const securityTransport = new DailyRotateFile({
  filename: path.join(getLogPath(), 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'info',
  format: customFormat,
});

// Application logs transport
const appTransport = new DailyRotateFile({
  filename: path.join(getLogPath(), 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: customFormat,
});

// Error logs transport
const errorTransport = new DailyRotateFile({
  filename: path.join(getLogPath(), 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: customFormat,
});

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: {
    app: 'cosmifill-ui',
    version: process.env.npm_package_version || '1.0.0',
    platform: process.platform,
  },
  transports: [
    appTransport,
    errorTransport,
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Security logger for audit trail
export const securityLogger = winston.createLogger({
  level: 'info',
  defaultMeta: {
    app: 'cosmifill-ui',
    type: 'security',
  },
  transports: [securityTransport],
});

// Log security events
export const logSecurityEvent = (event: string, details: any) => {
  securityLogger.info(event, {
    ...details,
    timestamp: new Date().toISOString(),
    sessionId: details.sessionId || 'unknown',
  });
};

// Helper functions for common logging patterns
export const logError = (error: Error, context?: any) => {
  logger.error(error.message, {
    stack: error.stack,
    ...context,
  });
};

export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`Performance: ${operation}`, {
    duration,
    operation,
    ...metadata,
  });
};

export const logUserAction = (action: string, details?: any) => {
  logger.info(`User action: ${action}`, {
    action,
    ...details,
  });
};

// Export for testing
export default logger;