// grammY Bot Types
import { Context, SessionFlavor } from 'grammy';
import { ConversationFlavor, Conversation } from '@grammyjs/conversations';
import { HydrateFlavor } from '@grammyjs/hydrate';

// Partnership types (matching website)
export type PartnershipType = 'sto' | 'dealer' | 'detailing' | 'tuning' | 'other';

// Session data stored in database
export interface SessionData {
  language: 'uk' | 'en' | 'ru';
  lastCategory?: 'auto' | 'moto' | 'general' | 'partnership';
  partnershipType?: PartnershipType;
  contactStep?: 'name' | 'email' | 'phone' | 'message' | 'category' | 'company' | 'website' | null;
  tempData?: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    category?: string;
    companyName?: string;
    website?: string;
    partnershipType?: PartnershipType;
  };
  menuMessageId?: number;
  isAdmin?: boolean;
}

// Custom properties interface
export interface CustomContextProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  isAdmin: boolean;
  telegramId: bigint;
}

// Build context step by step
type BaseContext = Context;
type WithSession = BaseContext & SessionFlavor<SessionData>;
type WithConversation = WithSession & ConversationFlavor<WithSession>;
type WithHydrate = HydrateFlavor<WithConversation>;

// Final bot context type
export type BotContext = WithHydrate & CustomContextProps;

// Conversation type
export type BotConversation = Conversation<BotContext>;

// Admin check result
export interface AdminCheckResult {
  isAdmin: boolean;
  role?: 'admin' | 'superadmin';
  permissions?: string[];
}

// Message data for contact form
export interface ContactFormData {
  name: string;
  email?: string;
  phone?: string;
  message: string;
  category: 'auto' | 'moto' | 'general' | 'partnership';
  telegramId: number;
  username?: string;
}

// Partnership form data
export interface PartnershipFormData {
  companyName: string;
  website?: string;
  contactPerson: string;
  email: string;
  phone: string;
  type: PartnershipType;
  message?: string;
  telegramId: number;
  username?: string;
}

// Translation keys structure
export interface TranslationKeys {
  welcome: string;
  selectLanguage: string;
  languageChanged: string;
  mainMenu: string;
  aboutUs: string;
  services: string;
  contact: string;
  autoProducts: string;
  motoProducts: string;
  partnership: string;
  sendRequest: string;
  enterName: string;
  enterEmail: string;
  enterPhone: string;
  enterMessage: string;
  selectCategory: string;
  requestSent: string;
  requestFailed: string;
  invalidEmail: string;
  adminPanel: string;
  noAccess: string;
  newMessages: string;
  allMessages: string;
  settings: string;
  back: string;
  cancel: string;
  confirm: string;
  catalog: string;
  priceList: string;
  website: string;
  partnershipWelcome: string;
  partnershipTypes: {
    sto: string;
    dealer: string;
    detailing: string;
    tuning: string;
    other: string;
  };
  enterCompanyName: string;
  enterWebsite: string;
  enterContactPerson: string;
  partnershipSent: string;
  categories: {
    auto: string;
    moto: string;
    general: string;
    partnership: string;
  };
  catalogIntro: string;
  autoBrands: string;
  motoBrands: string;
  searchBrand: string;
  popularBrands: string;
}

// Translations type
export type Translations = Record<'uk' | 'en' | 'ru', TranslationKeys>;
