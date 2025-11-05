/**
 * Type definitions for Headless CMS content models
 */

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
  url: string;
  description?: string;
  category: string;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  model3D?: string; // Path to .glb file
  icon?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeroProduct {
  id: string;
  name: string;
  description: string;
  brand: Brand;
  category: Category;
  model3D: string; // Path to .glb file
  partnerUrl: string;
  images?: string[];
  specifications?: Record<string, string>;
  featured?: boolean;
  displayOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Link {
  id: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  category?: string;
  displayOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SiteSettings {
  id: string;
  siteName: string;
  tagline?: string;
  logo?: string;
  favicon?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
  };
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

// API Response types
export interface APIResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface APIError {
  error: {
    status: number;
    name: string;
    message: string;
    details?: any;
  };
}
