import Database from 'better-sqlite3';
export declare function connectDB(dbPath?: string): Promise<Database.Database>;
export declare function createFundScema(): void;
export declare function deleteFundsSchema(): void;
export declare function clearAllData(db: Database.Database): void;
//# sourceMappingURL=sqlite-connector.d.ts.map