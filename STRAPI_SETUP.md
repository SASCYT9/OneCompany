# 📦 Strapi CMS Setup Guide

Повна інструкція по налаштуванню Headless CMS для onecompany.

## 🚀 Швидке Встановлення

### 1. Створіть Strapi проект

```bash
# В папці onecompany-3d створіть підпапку для CMS
npx create-strapi-app@latest cms --quickstart
```

Це створить:
- Strapi admin панель на http://localhost:1337/admin
- SQLite базу даних (для початку)
- Auto-generated REST API

### 2. Перший запуск

```bash
cd cms
npm run develop
```

Створіть першого admin користувача в браузері.

## 📋 Створення Content Types

### Brand (Бренд)

1. Відкрийте Content-Type Builder
2. Create new Collection Type: `Brand`
3. Додайте поля:

```
- name (Text, Required, Unique)
- slug (UID, attached to name)
- logo (Media, Single, Required)
- url (Text, Required)
- description (Rich Text)
- category (Relation -> Category)
- featured (Boolean, default: false)
```

### Category (Категорія)

Collection Type: `Category`

```
- name (Text, Required, Unique)
- slug (UID, attached to name)
- description (Rich Text)
- model3D (Media, Single) - для .glb файлів
- icon (Media, Single)
- brands (Relation -> Brand, many-to-many)
```

### Hero Product (Головний Продукт)

Collection Type: `HeroProduct`

```
- name (Text, Required)
- description (Rich Text, Required)
- brand (Relation -> Brand, many-to-one)
- category (Relation -> Category, many-to-one)
- model3D (Media, Single, Required) - .glb файл
- partnerUrl (Text, Required)
- images (Media, Multiple)
- specifications (JSON)
- featured (Boolean)
- displayOrder (Number)
```

### Link (Посилання)

Collection Type: `Link`

```
- title (Text, Required)
- url (Text, Required)
- description (Text)
- icon (Media, Single)
- category (Text)
- displayOrder (Number)
```

### Site Settings

Single Type: `SiteSetting`

```
- siteName (Text)
- tagline (Text)
- logo (Media, Single)
- favicon (Media, Single)
- socialLinks (Component - створіть SocialLinks)
  - facebook (Text)
  - instagram (Text)
  - youtube (Text)
  - linkedin (Text)
- contactEmail (Email)
- contactPhone (Text)
- address (Text)
```

## 🔐 Налаштування Доступу

### Public API для read-only

1. Settings → Users & Permissions → Roles
2. Виберіть `Public`
3. Увімкніть permissions для:
   - Brand: `find`, `findOne`
   - Category: `find`, `findOne`
   - HeroProduct: `find`, `findOne`
   - Link: `find`, `findOne`
   - SiteSetting: `find`

## 🔌 Підключення до Next.js

### 1. Встановіть клієнт

```bash
npm install @strapi/sdk-js
```

### 2. Створіть API клієнт

`src/lib/strapi.ts`:

```typescript
const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

export async function fetchAPI(
  endpoint: string,
  options: RequestInit = {}
) {
  const url = `${STRAPI_URL}/api${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

// Get all brands
export async function getBrands() {
  const data = await fetchAPI('/brands?populate=*');
  return data.data;
}

// Get single brand
export async function getBrand(slug: string) {
  const data = await fetchAPI(`/brands?filters[slug][$eq]=${slug}&populate=*`);
  return data.data[0];
}

// Get hero products
export async function getHeroProducts() {
  const data = await fetchAPI('/hero-products?populate=*&filters[featured][$eq]=true');
  return data.data;
}

// Get categories
export async function getCategories() {
  const data = await fetchAPI('/categories?populate=*');
  return data.data;
}
```

### 3. Використання в компонентах

```typescript
// app/brands/page.tsx
import { getBrands } from '@/lib/strapi';

export default async function BrandsPage() {
  const brands = await getBrands();
  
  return (
    <div>
      {brands.map((brand) => (
        <BrandCard
          key={brand.id}
          name={brand.attributes.name}
          logo={brand.attributes.logo.data.attributes.url}
          url={brand.attributes.url}
          description={brand.attributes.description}
        />
      ))}
    </div>
  );
}
```

## 📁 Завантаження 3D Моделей

### 1. Налаштуйте MIME types

`cms/config/middlewares.js`:

```javascript
module.exports = [
  // ... інші middlewares
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:'],
          // Дозволити .glb файли
          'connect-src': ["'self'", 'https:'],
        },
      },
    },
  },
];
```

### 2. Завантажте моделі

1. Content Manager → Hero Products → Create new
2. Upload model3D → виберіть `.glb` файл
3. Заповніть інші поля
4. Publish

### 3. Використання в Next.js

```typescript
// components/3d/HeroProduct.tsx
const modelUrl = `${process.env.NEXT_PUBLIC_STRAPI_URL}${product.model3D.url}`;
const { scene } = useGLTF(modelUrl);
```

## 🌍 Environment Variables

`.env.local`:

```bash
NEXT_PUBLIC_STRAPI_URL=http://localhost:1337
```

Production:

```bash
NEXT_PUBLIC_STRAPI_URL=https://your-strapi.com
```

## 🚀 Deploy Strapi

### Option 1: Strapi Cloud (Найлегше)

1. https://cloud.strapi.io/
2. Connect your GitHub repo
3. Deploy

### Option 2: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway init
railway up
```

### Option 3: DigitalOcean

1. Create Droplet (Ubuntu 22.04)
2. Install Node.js 18+
3. Clone repo
4. `npm install && npm run build`
5. Use PM2: `pm2 start npm -- start`

## 💾 Міграція з SQLite на PostgreSQL

Для production використовуйте PostgreSQL:

```bash
npm install pg
```

`cms/config/database.js`:

```javascript
module.exports = ({ env }) => ({
  connection: {
    client: 'postgres',
    connection: {
      host: env('DATABASE_HOST', '127.0.0.1'),
      port: env.int('DATABASE_PORT', 5432),
      database: env('DATABASE_NAME', 'strapi'),
      user: env('DATABASE_USERNAME', 'strapi'),
      password: env('DATABASE_PASSWORD', 'strapi'),
      ssl: env.bool('DATABASE_SSL', false),
    },
  },
});
```

## 📊 Приклад даних для тесту

### Brands

```json
[
  {
    "name": "KW Suspensions",
    "slug": "kw-suspensions",
    "url": "https://www.kwsuspensions.com",
    "description": "Преміальні койловери з Німеччини",
    "category": "Підвіска",
    "featured": true
  },
  {
    "name": "Akrapovič",
    "slug": "akrapovic",
    "url": "https://www.akrapovic.com",
    "description": "Титанові вихлопні системи",
    "category": "Вихлоп",
    "featured": true
  }
]
```

## 🔧 Troubleshooting

### Проблема: 403 Forbidden

**Рішення**: Перевірте Settings → Roles → Public permissions

### Проблема: CORS errors

**Рішення**: `cms/config/middlewares.js`

```javascript
{
  name: 'strapi::cors',
  config: {
    origin: ['http://localhost:3000', 'https://your-domain.com'],
  },
}
```

### Проблема: .glb файли не завантажуються

**Рішення**: Збільште ліміт розміру файлів

`cms/config/plugins.js`:

```javascript
module.exports = {
  upload: {
    config: {
      sizeLimit: 50 * 1024 * 1024, // 50MB
    },
  },
};
```

---

**Готово!** Тепер ви можете керувати всім контентом через Strapi admin панель! 🎉
