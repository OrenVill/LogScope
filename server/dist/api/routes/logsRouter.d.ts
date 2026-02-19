import { IFileStorage } from "../../storage/fileStorage";
import { IQueryIndex } from "../../storage";
import { WsLogServer } from "../../ws/wsServer";
export declare const createLogsRouter: (storage: IFileStorage, queryIndex: IQueryIndex, wsServer?: WsLogServer) => import("express-serve-static-core").Router;
//# sourceMappingURL=logsRouter.d.ts.map