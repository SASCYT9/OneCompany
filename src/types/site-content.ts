export type BrandEntry = {
  name: string;
  logo: string;
};

export type ProductCategory = {
  name: string;
  description: string;
};

export type StatHighlight = {
  value: string;
  label: string;
};

export type HeroContent = {
  badge: string;
  title: string;
  subtitle: string;
  ctaAutoLabel: string;
  ctaMotoLabel: string;
  scrollLabel: string;
  globalPresence: string;
  brandPromise: string;
  atelierAddress: string;
};

export type ContactCta = {
  heading: string;
  body: string;
  buttonLabel: string;
  buttonHref: string;
};

export type ContactChannel = {
  id: string;
  label: string;
  value: string;
  note: string;
  type: 'email' | 'phone' | 'telegram' | 'whatsapp';
};

export type ContactSuccessStory = {
  id: string;
  badge: string;
  title: string;
  summary: string;
  metric: string;
  metricLabel: string;
};

export type ContactPageContent = {
  heroBadge: string;
  infoBody: string;
  timezoneNote: string;
  slaPromise: string;
  messengerTagline: string;
  budgets: string[];
  channels: ContactChannel[];
  successStories: ContactSuccessStory[];
  messengerHandles: {
    telegram: string;
    whatsapp: string;
    phone: string;
  };
};

export type SiteContent = {
  hero: HeroContent;
  marqueeBrands: string[];
  statHighlights: StatHighlight[];
  values: string[];
  brandSections: {
    automotive: BrandEntry[];
    moto: BrandEntry[];
  };
  productCategories: ProductCategory[];
  contactCta: ContactCta;
  contactPage: ContactPageContent;
};
