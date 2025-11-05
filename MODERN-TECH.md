# 🚀 OneCompany - Найсучасніші технології 2025

## ✨ Технологічний стек

### Core Framework
- **Next.js 16.0.1** (Turbopack) - Найшвидший build tool
- **React 19.2.0** - React Compiler, Server Components
- **TypeScript 5** - Type safety

### 3D & WebGL
- **Three.js 0.181.0** - 3D рендеринг
- **React Three Fiber 9.4** - React для Three.js
- **React Three Drei 10.7.6** - Helper компоненти
- **React Three Postprocessing 3.0.4** - Post-processing ефекти

### Анімації
- **GSAP 3.13.0** + ScrollTrigger - Професійні scroll-driven анімації
- **Framer Motion** - Декларативні React анімації
- **Lenis** - Найплавніший smooth scroll 2025 року

### Стилізація
- **Tailwind CSS 4** - Utility-first CSS з performance optimization
- **PostCSS** - CSS preprocessing

### State Management
- **Zustand** - Легкий і швидкий state manager

### Performance
- **Turbopack** - Next-gen bundler (замість Webpack)
- **React Compiler** - Автоматична оптимізація
- **Code splitting** - Автоматичне розділення коду

---

## 🎯 Доступні демо сторінки

### 1. `/demo` - Modern Scroll Animation
**Технології:** Lenis + Framer Motion + GSAP ScrollTrigger

**Особливості:**
- ✅ Butter-smooth scroll з Lenis
- ✅ Pinned секція з 400vh віртуального скролу
- ✅ 3 послідовні анімації (KW → Fi → Eventuri)
- ✅ Gradient background transitions
- ✅ Scale + Opacity animations
- ✅ Progress bar indicator
- ✅ Responsive design

**Запуск:**
```
http://localhost:3000/demo
```

---

### 2. `/demo-3d` - 3D Parallax Experience
**Технології:** React Three Fiber + Framer Motion + Postprocessing

**Особливості:**
- ✅ WebGL 3D сцена з TorusKnot geometry
- ✅ MeshTransmissionMaterial (glass effect)
- ✅ Bloom & Chromatic Aberration post-processing
- ✅ 3D object rotation based on scroll
- ✅ Parallax overlay content
- ✅ Smooth spring animations
- ✅ Interactive orbit controls

**Запуск:**
```
http://localhost:3000/demo-3d
```

---

## 🛠️ Встановлені пакети

```json
{
  "dependencies": {
    "@react-three/drei": "^10.7.6",
    "@react-three/fiber": "^9.4.0",
    "@react-three/postprocessing": "^3.0.4",
    "framer-motion": "^11.11.17",
    "gsap": "^3.13.0",
    "lenis": "^1.1.17",
    "zustand": "^5.0.2",
    "next": "16.0.1",
    "react": "19.2.0",
    "three": "^0.181.0"
  }
}
```

---

## 🎨 Фічі які використовуємо

### 1. **Lenis Smooth Scroll**
```typescript
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 1,
});
```

### 2. **Framer Motion Transforms**
```typescript
const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.5, 0]);
const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
```

### 3. **GSAP ScrollTrigger Pin**
```typescript
scrollTrigger: {
  trigger: section,
  start: 'top top',
  end: '+=3000',
  scrub: true,
  pin: true,
}
```

### 4. **Three.js Post-processing**
```typescript
<EffectComposer>
  <Bloom intensity={1.5} />
  <ChromaticAberration offset={[0.002, 0.002]} />
</EffectComposer>
```

---

## 🚀 Чому це найсучасніше?

### ✅ Performance
- **Turbopack** - До 700x швидше ніж Webpack
- **React Compiler** - Автоматична мемоізація
- **Lenis** - Hardware-accelerated scroll

### ✅ Developer Experience
- **TypeScript** - Type safety
- **Hot Module Replacement** - Миттєві оновлення
- **Tailwind CSS 4** - JIT compiler

### ✅ User Experience  
- **Smooth scroll** - 60 FPS на всіх пристроях
- **3D WebGL** - Інтерактивні сцени
- **Responsive** - Mobile-first підхід

### ✅ Modern Features
- **Server Components** - React 19
- **Parallel Routes** - Next.js 16
- **Optimistic Updates** - Framer Motion

---

## 📦 Як додати ще більше?

### WebGPU (майбутнє Three.js)
```bash
npm install @webgpu/types
```

### AI Integration
```bash
npm install @vercel/ai openai
```

### Real-time Collaboration
```bash
npm install y-websocket yjs
```

### Advanced Physics
```bash
npm install @react-three/rapier --legacy-peer-deps
```

---

## 🎯 Roadmap

- [ ] WebGPU renderer для Three.js
- [ ] AI-генерація 3D моделей
- [ ] Real-time multiplayer
- [ ] Voice commands
- [ ] AR/VR support через WebXR

---

**Створено з ❤️ використовуючи найсучасніші технології 2025 року**
