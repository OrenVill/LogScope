"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
/**
 * Error handling middleware for Express
 */
const errorHandler = (err, req, res, next) => {
    console.error("Error:", err);
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || "INTERNAL_SERVER_ERROR";
    const message = err.message || "An unexpected error occurred";
    const response = {
        success: false,
        error: message,
        errorCode,
    };
    res.status(statusCode).json(response);
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map