export interface IOFundModel {
    _id?: any;
    id: number;
    name: string;
    aliases: string[];
    manager: string;
    vintage: number;
    strategy: string;
    geography: string;
    strategyGroup?: string;
    geographyGroup?: string;
    fundSize: number;
    targetSize: number;
    status: string;
    industries?: string[];
}
//# sourceMappingURL=fund.types.d.ts.map