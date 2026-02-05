 /**
  * Data category for live/demo data segregation
  * Single Source of Truth - used across all government analytics
  */
 export type DataCategory = 'live' | 'demo' | 'all';
 
 /**
  * Default data category when not specified
  */
 export const DEFAULT_DATA_CATEGORY: DataCategory = 'live';