// Strongly-typed view of a Fund document coming from MongoDB
// Fields mirror the projection in mongo-connector
export interface IOFundModel {
  id: number;  /// sql primary key
  _id: string;             // MongoDB document id (stringified)
  name: string;            // Fund name
  aliases: string[];      // Alternate names
  fundType?: string;       // legacy; not persisted
  manager: string;        // Fund manager (future)
  vintage: number;        // Year
  strategy: string;
  geography: string;
  strategyGroup?: string;
  geographyGroup?: string;
  fundSize: number;
  targetSize: number;
  status: string;         // e.g., Active, Closed, Raising
  industries?: string[];   // Focus industries
}
