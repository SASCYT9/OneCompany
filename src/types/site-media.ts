export type StoreId = 'kw' | 'fi' | 'eventuri';

export interface CatalogProduct {
  id?: string;
  name?: string;
  image?: string;
  description?: string;
  series?: string;
  price?: string;
  compatibility?: string;
  features?: string[];
  specs?: string[];
  url?: string;
}

export interface GalleryItem {
  id: string;
  image: string;
  caption?: string;
}

export interface StoreMediaSection {
  heroPoster: string;
  catalogProducts: CatalogProduct[];
  gallery: GalleryItem[];
}

export interface SiteMedia {
  heroPosters: {
    auto: string;
    moto: string;
  };
  stores: Record<StoreId, StoreMediaSection>;
}
