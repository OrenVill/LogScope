import { Request, Response, NextFunction } from "express";
/**
 * Error handling middleware for Express
 */
export declare const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=errorHandler.d.ts.map