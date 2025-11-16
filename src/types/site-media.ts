export type StoreId = 'kw' | 'fi' | 'eventuri';

export interface ShowcaseProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  specs: string[];
}

export interface CatalogProduct extends ShowcaseProduct {
  series?: string;
  price?: string;
  compatibility?: string;
  features?: string[];
}

export interface GalleryItem {
  id: string;
  image: string;
  caption?: string;
}

export interface StoreMediaSection {
  heroPoster: string;
  brandShowcase: ShowcaseProduct[];
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
