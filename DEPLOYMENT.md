# 🚀 Deployment Guide

Повна інструкція по деплою onecompany 3D Experience Hub у production.

## 📋 Pre-deployment Checklist

- [ ] 3D моделі (.glb) додані та оптимізовані
- [ ] Відео fallback створено для мобільних
- [ ] Логотипи брендів у форматі SVG/PNG
- [ ] Environment variables налаштовані
- [ ] Strapi CMS розгорнуто (якщо використовується)
- [ ] SEO meta tags додані
- [ ] Performance тестування пройдено
- [ ] Cross-browser тестування завершено

## 🌐 Варіанти Деплою

### Option 1: Vercel (Рекомендовано) ⭐

**Чому Vercel:**
- ✅ Створено командою Next.js
- ✅ Zero-config deployment
- ✅ Automatic HTTPS
- ✅ Edge CDN worldwide
- ✅ Free tier достатній для MVP

#### Швидкий Deploy

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/onecompany.git
git push -u origin main
```

2. **Connect to Vercel:**
- Відвідайте [vercel.com](https://vercel.com)
- Sign up з GitHub
- Click "Import Project"
- Виберіть ваш repo
- Vercel автоматично визначить Next.js

3. **Environment Variables:**
```env
NEXT_PUBLIC_STRAPI_URL=https://your-strapi.com
```

4. **Deploy:**
- Click "Deploy"
- ☕ Чекайте 2-3 хвилини
- 🎉 Done!

**Custom Domain:**
```
Settings → Domains → Add
```

---

### Option 2: Netlify

#### Deploy команди

```bash
# Build command
npm run build

# Publish directory
.next

# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

#### netlify.toml

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

### Option 3: AWS Amplify

#### amplify.yml

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm install
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

---

### Option 4: Self-hosted (VPS)

#### Для Digital Ocean / Linode / Vultr

1. **Create Droplet (Ubuntu 22.04):**
```bash
# Connect via SSH
ssh root@your-server-ip
```

2. **Install Node.js 18+:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install PM2:**
```bash
npm install -g pm2
```

4. **Clone & Build:**
```bash
cd /var/www
git clone https://github.com/yourusername/onecompany.git
cd onecompany
npm install
npm run build
```

5. **Start with PM2:**
```bash
pm2 start npm --name "onecompany" -- start
pm2 save
pm2 startup
```

6. **Nginx Reverse Proxy:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

7. **SSL з Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🔧 Environment Variables

### Production .env

```bash
# Strapi CMS
NEXT_PUBLIC_STRAPI_URL=https://cms.yourdomain.com

# Analytics (опціонально)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Site URL
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

---

## 📦 Build Optimization

### next.config.ts

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    domains: ['your-strapi-domain.com'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Compress all assets
  compress: true,
  
  // Enable SWC minification
  swcMinify: true,
  
  // Experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['three', '@react-three/fiber', '@react-three/drei'],
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

---

## 🎯 Performance Optimization

### 1. Image Optimization

```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src="/brands/logo.svg"
  alt="Brand"
  width={200}
  height={100}
  loading="lazy"
  quality={85}
/>
```

### 2. 3D Model Compression

```bash
# Install gltf-pipeline
npm install -g gltf-pipeline

# Compress with Draco
gltf-pipeline -i model.glb -o model-compressed.glb -d
```

### 3. Code Splitting

```typescript
// Dynamic import for 3D scene
const Scene = dynamic(() => import('@/components/3d/Scene'), {
  ssr: false,
  loading: () => <Loading />
});
```

### 4. Font Optimization

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'cyrillic'], // Для української
  display: 'swap',
});
```

---

## 📊 Analytics Setup

### Google Analytics

```bash
npm install @next/third-parties
```

```typescript
// app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      </body>
    </html>
  );
}
```

### Vercel Analytics

```bash
npm install @vercel/analytics
```

```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

---

## 🔍 SEO Optimization

### app/layout.tsx

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'onecompany - Преміальний автотюнінг',
  description: 'Ексклюзивний доступ до провідних світових брендів автотюнінгу. KW, Akrapovič, Brembo, HRE Wheels та інші.',
  keywords: ['автотюнінг', 'койловери', 'вихлоп', 'гальма', 'диски'],
  authors: [{ name: 'onecompany' }],
  openGraph: {
    title: 'onecompany - 3D Experience Hub',
    description: 'Перфоманс. Візуалізований.',
    url: 'https://yourdomain.com',
    siteName: 'onecompany',
    images: [
      {
        url: 'https://yourdomain.com/og-image.jpg',
        width: 1200,
        height: 630,
      },
    ],
    locale: 'uk_UA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'onecompany',
    description: 'Преміальний автотюнінг',
    images: ['https://yourdomain.com/twitter-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

### robots.txt

```
# public/robots.txt
User-agent: *
Allow: /
Sitemap: https://yourdomain.com/sitemap.xml
```

### sitemap.xml

```typescript
// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://yourdomain.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://yourdomain.com/brands',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ];
}
```

---

## 📈 Monitoring

### Vercel Analytics Dashboard

```bash
# Automatic in Vercel
- Page views
- Unique visitors
- Top pages
- Real User Monitoring (RUM)
```

### Sentry Error Tracking

```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});
```

---

## ✅ Post-deployment Testing

### Lighthouse Score

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse https://yourdomain.com --view
```

**Targets:**
- Performance: 90+
- Accessibility: 95+
- Best Practices: 90+
- SEO: 100

### Cross-browser Testing

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

### WebGL Support Check

Тестуйте на: https://get.webgl.org/

---

## 🐛 Common Issues

### Issue: 3D scene white screen on production

**Solution:**
```typescript
// Ensure dynamic import with ssr: false
const Scene = dynamic(() => import('@/components/3d/Scene'), {
  ssr: false
});
```

### Issue: CORS errors with Strapi

**Solution:** Strapi middleware config
```javascript
// strapi/config/middlewares.js
{
  name: 'strapi::cors',
  config: {
    origin: ['https://yourdomain.com'],
  },
}
```

### Issue: Slow initial load

**Solution:**
1. Preload critical 3D models
2. Use placeholder while loading
3. Implement progressive loading

---

## 🎉 Success Metrics

### Performance
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.8s
- Cumulative Layout Shift (CLS): < 0.1

### Engagement
- Average session duration: 2+ minutes
- Bounce rate: < 40%
- Pages per session: 3+

---

**Готово до launch! 🚀**

Для підтримки та питань створіть issue на GitHub.
