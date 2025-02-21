const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const rotateConfig = {
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxFiles: '14d'
};

const errorTransport = new transports.DailyRotateFile({
    filename: 'logs/error/%DATE%-error.log',
    level: 'error',
    ...rotateConfig
});

const logger = createLogger({
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3,
        trace: 4
    },
    format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, category, ...meta }) => {
            return JSON.stringify({
                timestamp,
                level,
                category: category || 'general',
                message,
                ...meta
            });
        })
    ),
    transports: [
        errorTransport,
        // Combined logs
        new transports.File({
            filename: path.join('logs', 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        // Development console output
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            )
        })
    ]
});

// Add category-specific logging methods
const categoryLogger = (category) => ({
    error: (message, meta = {}) => logger.error({ category, message, ...meta }),
    warn: (message, meta = {}) => logger.warn({ category, message, ...meta }),
    info: (message, meta = {}) => logger.info({ category, message, ...meta }),
    debug: (message, meta = {}) => logger.debug({ category, message, ...meta }),
    trace: (message, meta = {}) => logger.trace({ category, message, ...meta })
});

module.exports = { logger, categoryLogger };