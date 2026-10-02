export type TransitName={zh:string;en:string};
export type TransitSource={url:string;retrieved_at:string;generated_at:string;expires_at:string};
export type PublicRoute={id:string;operator:'kmb'|'gmb';code:string;direction:string;service_type:string;origin:TransitName;destination:TransitName;description:TransitName;remark:TransitName;source:TransitSource};
export type PublicStop={id:string;sequence:number;name:TransitName};
export type TransitCatalog={routes:PublicRoute[];issues:{operator:'kmb'|'gmb';route_code:string;reason:'unavailable'|'stale'|'not_listed'}[];generated_at:string};
export type TransitStops={route:PublicRoute|null;status:'available'|'unavailable'|'stale';stops:PublicStop[];sources:TransitSource[];generated_at:string};
export type TransitArrivals={route_id:string;stop_sequence:number;stop:PublicStop|null;status:'available'|'no_predictions'|'unavailable'|'stale'|'disabled';arrivals:{at:string;remark:TransitName}[];messages:TransitName[];source:TransitSource|null;expires_at:string|null;generated_at:string};
