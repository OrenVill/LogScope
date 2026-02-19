"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
/**
 * Error handling middleware for Express
 */
const errorHandler = (err, req, res, next) => {
    console.error("Error:", err);
    // Handle payload too large errors
    if (err.code === "PAYLOAD_TOO_LARGE" || err.status === 413) {
        return res.status(413).json({
            success: false,
            error: "Payload too large. Request body exceeds 1MB limit.",
            errorCode: "PAYLOAD_TOO_LARGE",
        });
    }
    // Handle JSON parsing errors
    if (err.status === 400 && err instanceof SyntaxError) {
        return res.status(400).json({
            success: false,
            error: "Invalid JSON in request body",
            errorCode: "INVALID_JSON",
        });
    }
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