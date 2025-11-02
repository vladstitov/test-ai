type AnyDoc = Record<string, any>;
import type { IOFundModel } from './fund.types';
export declare function getFunds(offset?: number, limit?: number): Promise<IOFundModel[]>;
export declare function getPrices(offset?: number, limit?: number): Promise<AnyDoc[]>;
export {};
//# sourceMappingURL=mongo-connector.d.ts.map