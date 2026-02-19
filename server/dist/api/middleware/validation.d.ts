import { Request, Response, NextFunction } from "express";
export declare const rateLimitMiddleware: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const validateLogEntry: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Validate search/filter parameters
 */
export declare const validateSearchParams: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=validation.d.ts.map