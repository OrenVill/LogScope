import { IFileStorage } from "../../storage/fileStorage.js";
import { IQueryIndex } from "../../storage/index.js";
import { WsLogServer } from "../../ws/wsServer.js";
export declare const createLogsRouter: (storage: IFileStorage, queryIndex: IQueryIndex, wsServer?: WsLogServer) => import("express-serve-static-core").Router;
//# sourceMappingURL=logsRouter.d.ts.map