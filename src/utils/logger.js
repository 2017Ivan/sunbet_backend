const fs = require('fs');
const path = require('path');
const os = require('os');
const winston = require('winston');
require('winston-daily-rotate-file');
const { v4: uuidv4 } = require('uuid');

const logsDir = path.join(
    process.cwd(),
    'logs'
);

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, {
        recursive: true
    });
}

const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
};

const getErrorLocation =
    stack => {
        if (!stack) {
            return {};
        }

        const lines =
            stack.split('\n');

        const target =
            lines.find(
                line =>
                    line.includes(
                        process.cwd()
                    )
            );

        if (!target) {
            return {};
        }

        const match =
            target.match(
                /(.*):(\d+):(\d+)/
            );

        if (!match) {
            return {};
        }

        return {
            file: match[1]
                .replace(
                    /^.*\(/,
                    ''
                )
                .trim(),
            line: match[2],
            column: match[3]
        };
    };

const customFileFormat =
    winston.format.printf(
        info => {
            const request =
                info.request ||
                {};

            const error =
                info.error || {};

            return `
============================================================
TIME: ${info.timestamp}
TYPE: ${String(
                info.level
            ).toUpperCase()}

MESSAGE:
${error.message ||
                info.message ||
                ''}

METHOD:
${request.method ||
                ''}

PATH:
${request.path || ''}

USER:
${request.user || ''}

IP:
${request.ip || ''}

FILE:
${error.file || ''}

LINE:
${error.line || ''}

CODE:
${error.code || ''}

STACK:
${error.stack || ''}

============================================================

`;
        }
    );

const dailyRotateTransport =
    new winston.transports.DailyRotateFile(
        {
            dirname: logsDir,
            filename:
                '%DATE%.log',
            datePattern:
                'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d'
        }
    );

const logger =
    winston.createLogger({
        level:
            process.env
                .NODE_ENV ===
            'production'
                ? 'info'
                : 'debug',

        format:
            winston.format.combine(
                winston.format.timestamp(
                    {
                        format:
                            'YYYY-MM-DD HH:mm:ss'
                    }
                ),
                customFileFormat
            ),

        transports: [
            dailyRotateTransport
        ]
    });

const sanitizeObject = (
    obj = {}
) => {
    try {
        const clone = JSON.parse(
            JSON.stringify(obj)
        );

        const sensitiveFields = [
            'password',
            'pin',
            'token',
            'accesstoken',
            'refreshtoken',
            'authorization',
            'secret'
        ];

        const sanitize =
            data => {
                if (
                    !data ||
                    typeof data !==
                        'object'
                ) {
                    return;
                }

                Object.keys(
                    data
                ).forEach(
                    key => {
                        if (
                            sensitiveFields.includes(
                                key.toLowerCase()
                            )
                        ) {
                            data[
                                key
                            ] =
                                '******';
                        }

                        if (
                            typeof data[
                                key
                            ] ===
                                'object' &&
                            data[
                                key
                            ] !==
                                null
                        ) {
                            sanitize(
                                data[
                                    key
                                ]
                            );
                        }
                    }
                );
            };

        sanitize(clone);

        return clone;
    } catch {
        return {};
    }
};

const getRequestUser =
    req => {
        if (!req) {
            return 'anonymous';
        }

        return (
            req?.user?.id ||
            req?.user?.userId ||
            req?.user
                ?.phone_number ||
            'anonymous'
        );
    };

const info = (
    message,
    meta = {}
) => {
    logger.info(message, meta);
};

const warn = (
    message,
    meta = {}
) => {
    logger.warn(message, meta);
};

const error = (
    message,
    meta = {}
) => {
    logger.error(message, meta);
};

const debug = (
    message,
    meta = {}
) => {
    logger.debug(message, meta);
};

const requestLogger = (
    req,
    res,
    next
) => {
    req.requestId =
        uuidv4();

    next();
};

const errorLog = (
    err,
    req = null
) => {
    const location =
        getErrorLocation(
            err?.stack
        );

    logger.error(
        'APPLICATION_ERROR',
        {
            request: {
                method:
                    req?.method,
                path:
                    req?.originalUrl,
                user:
                    getRequestUser(
                        req
                    ),
                ip:
                    req?.ip
            },

            error: {
                message:
                    err?.message,
                code:
                    err?.code,
                file:
                    location.file,
                line:
                    location.line,
                stack:
                    err?.stack
            }
        }
    );
};

const errorMiddleware = (
    err,
    req,
    res,
    next
) => {
    errorLog(err, req);

    res.status(
        err.statusCode ||
            500
    ).json({
        success: false,
        message:
            process.env
                .NODE_ENV ===
            'production'
                ? 'Internal Server Error'
                : err.message
    });
};

const registerGlobalHandlers =
    () => {
        process.on(
            'uncaughtException',
            err => {
                errorLog(
                    err
                );
            }
        );

        process.on(
            'unhandledRejection',
            reason => {
                const err =
                    reason instanceof
                    Error
                        ? reason
                        : new Error(
                              String(
                                  reason
                              )
                          );

                errorLog(
                    err
                );
            }
        );
    };

module.exports = {
    logger,
    info,
    warn,
    error,
    debug,
    requestLogger,
    errorLog,
    errorMiddleware,
    registerGlobalHandlers,
    LOG_LEVELS
};