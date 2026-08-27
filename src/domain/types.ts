export type Campus = 'clear-water-bay';

export interface CampusService {
  id: string;
  name: string;
  owner: string;
  campus: Campus;
  url: string;
  purpose: string;
  keywords: string[];
  updatePolicy: string;
}
