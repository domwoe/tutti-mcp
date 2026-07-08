export interface ListingSummary {
  id: string;
  title: string;
  price: string | null;
  location: string | null;
  category: string | null;
  timestamp: string | null;
  url: string;
}

export interface SearchResultPage {
  totalCount: number;
  resolvedLocation?: string;
  listings: ListingSummary[];
  nextCursor: string | null;
}

export interface ListingDetail extends ListingSummary {
  description: string | null;
  seller: { id: string; alias: string | null } | null;
  images: string[];
  address: string | null;
  source: string | null;
  language: string | null;
}

export interface CategoryNode {
  id: string;
  label: string;
  children: CategoryNode[];
}

export interface LocalitySummary {
  id: string;
  name: string;
  type: string | null;
}

export interface TuttiSearchParams {
  query?: string;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  freeOnly?: boolean;
  location?: string;
  radiusKm?: number;
  sort?: "timestamp";
  direction?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

export interface TuttiAdapter {
  search(params: TuttiSearchParams): Promise<SearchResultPage>;
  getListing(id: string): Promise<ListingDetail>;
  getCategories(): Promise<CategoryNode[]>;
  searchLocalities(text: string): Promise<LocalitySummary[]>;
}
