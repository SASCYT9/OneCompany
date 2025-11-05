# 🚀 Onecompany - МАКСИМАЛЬНО Вражаючий 3D Сайт-Хаб

## 🎬 Кінематографічні 3D Слайди

### 📍 **5 Екранів з Унікальними Ефектами**

#### **Екран 0: Logo Intro**
- 🌌 Віддалений широкий план (z: 12)
- ✨ Gradient текст (Orange → Cyan → Purple)
- ⭐ 15,000 зірок на фоні
- 💫 200 Sparkles з динамічним кольором

#### **Екран 1: KW Suspension** 🇩🇪
**3D Об'єкт:**
- 🔴 Orange/Red Transmission Torus (койловер)
- 🔁 3 orbital rings (precision engineering)
- 🌟 500 German flag color particles
- 💡 Orange + Gold lighting

**UI Hero Section:**
- 📋 "ТОТАЛЬНИЙ КОНТРОЛЬ" headline
- 🏆 3 feature cards: Німецька якість, Автоспорт, Інновації
- 📊 Stats: "30+ РОКІВ НА ПОДІУМІ", "1000+ ПЕРЕМОГ"
- 🔗 CTA: "Підібрати підвіску" → kwsuspension.shop

**Camera:**
- 📹 Position: x: -4, y: 2, z: 6
- 🔄 Rotation: y: π*0.3, x: -0.2
- 🎥 Різкий заїзд з обертанням

---

#### **Екран 2: Fi Exhaust** 🔊
**3D Об'єкт:**
- 🔵 Blue/Cyan Transmission Cylinder (exhaust pipe)
- 🔥 5 flame particles (Blue/Cyan alternating)
- 🌊 4 sound wave rings
- 💡 Cyan + Sky Blue lighting + Spotlight

**UI Hero Section:**
- 📋 "Fi EXHAUST - ЗВУК ТА ПОТУЖНІСТЬ"
- ⚡ 3 feature cards: Valvetronic, Потужність, Унікальний звук
- 📊 Stats: "УНІКАЛЬНИЙ ТЕМБР", "+30 HP ГАРАНТОВАНО"
- 🔗 CTA: "Обрати вихлоп" → fiexhaust.shop
- ✨ Sliding shine effect on button

**Camera:**
- 📹 Position: x: 5, y: -1, z: 4
- 🔄 Rotation: y: -π*0.4, x: 0.15, z: 0.1
- 🎥 Агресивний обертальний рух з іншого боку

---

#### **Екран 3: Eventuri** 🏎️
**3D Об'єкт:**
- 🟣 Purple/Pink Transmission Box (carbon intake)
- 🌀 6 aerodynamic flow lines (torus)
- 💎 800 carbon fiber particles
- 💡 Purple + Pink + Magenta tri-lighting

**UI Hero Section:**
- 📋 "EVENTURI - АЕРОДИНАМІКА І КАРБОН"
- 💎 4 feature cards: Аеродинаміка, Карбон, Потужність, Track Proven
- 📊 Stats: "ІНЖЕНЕРНА АЕРОДИНАМІКА", "ТЕСТОВАНО НА ТРЕКУ"
- 🔗 CTA: "Обрати Eventuri" → eventuri.shop

**Camera:**
- 📹 Position: x: 0, y: 4, z: 5
- 🔄 Rotation: y: 0, x: -0.4
- 🎥 Плавний заїзд зверху (елегантний)

---

#### **Екран 4: All Stores**
- 📇 3 StoreCard компоненти (550px height)
- 🎨 Індивідуальні градієнти для кожного
- ✨ Neon pulse borders
- 🌊 Gradient shift animation
- 💫 Card glow effect

**Camera:**
- 📹 Position: x: 0, y: 1, z: 10
- 🔄 Rotation: y: 0, x: -0.1
- 🎥 Широкий відїзд назад

---

## 🎨 МАКСИМАЛЬНІ Postprocessing Effects

### EffectComposer Stack:
1. **Bloom** 
   - Intensity: 2.0
   - Threshold: 0.2
   - Smoothing: 0.95
   - Mipmap: ✅
   - Levels: 8

2. **Chromatic Aberration**
   - Offset: [0.002, 0.002]
   - BlendFunction: NORMAL

3. **Vignette**
   - Offset: 0.3
   - Darkness: 0.5

4. **Depth of Field**
   - Focus Distance: 0.01
   - Focal Length: 0.05
   - Bokeh Scale: 3

---

## ⚡ Динамічне Освітлення

**Adaptive Lighting Based on Slide:**
- Slide 0: White + Cyan
- Slide 1: Orange + Gold (KW)
- Slide 2: Cyan + Sky Blue (Fi)
- Slide 3: Purple + Pink (Eventuri)

**Total Lights per Scene:**
- 1 Ambient (0.15 intensity)
- 2-3 Spotlights (dynamic)
- 1-4 PointLights (від 3D об'єктів)

---

## 💫 Particle Systems

### Global ParticleSystem:
- **Count:** 5,000 частинок
- **Colors:** Orange/Blue/Purple gradient (по магазинах)
- **Sizes:** Variable (0.1-0.3)
- **Animation:** Multi-axis rotation + breathing pulse
- **Blending:** Additive

### Store-Specific Particles:
- **KW:** 500 stars (German colors)
- **Fi:** 5 flame spheres (Blue/Cyan)
- **Eventuri:** 800 carbon stars

### Dynamic Sparkles:
- **Count:** 200
- **Color:** Змінюється залежно від slide
- **Speed:** 0.4
- **Opacity:** 0.5

---

## 🎯 StoreCard Premium Features

### Розміри і Стилі:
- **Height:** 550px
- **Border Radius:** 3xl (24px)
- **Backdrop Blur:** 2xl
- **Scale on Hover:** 1.03

### Анімації:
1. **Neon Pulse** - animated border glow
2. **Gradient Shift** - 15s infinite background
3. **Card Glow** - box-shadow pulse
4. **Scan Effect** - vertical gradient sweep
5. **Bottom Accent Line** - animated gradient reveal

### Typography:
- **Title:** 6xl extralight (tracking: wider)
- **Tagline:** tracking: 0.4-0.5em (luxury spacing)
- **Category Badge:** tracking: 0.3em uppercase

### Interactive Elements:
- **Button:** Sliding entrance from left (-translate-x-8)
- **Arrow:** Scale + translate on hover
- **Features:** Fade + slide up
- **Corner Accent:** Dramatic blur expansion

---

## 🎬 Camera Movements (GSAP Timeline)

### Screen Transitions:
```
0 → 1: Logo fade (1.5s) + Camera approach
Duration: 3.5s total

1 → 2: KW orbit (-4, 2, 6) with rotation
Duration: 2.5s

2 → 3: Fi aggressive swing (5, -1, 4)
Duration: 2.5s

3 → 4: Eventuri top dive (0, 4, 5)
Duration: 2.5s

4 → END: Wide pullback (0, 1, 10)
Duration: 3s
```

### Scroll Settings:
- **Scrub:** 2 (дуже плавний)
- **Lerp:** 0.05 (smooth follow)
- **Total Height:** 500vh

---

## 🖼️ StoreHeroSection Components

### Кожен магазин має:
1. **Category Badge** - з gradient + glow
2. **Headline** - 8xl з neon pulse
3. **Tagline** - 2xl light
4. **Stats Row** - animated badges
5. **3-4 Feature Cards** - з hover effects
6. **CTA Button** - gradient + shine effect

### Загальні фічі:
- ✅ Staggered animations (delay-200, delay-500, delay-700)
- ✅ Translate + opacity transitions
- ✅ Visibility based on currentSlide state
- ✅ Pointer-events-auto для кліків

---

## 📱 Технічний Stack

### 3D:
- React Three Fiber
- @react-three/drei (Float, MeshTransmissionMaterial, Stars, Sparkles, Environment)
- @react-three/postprocessing
- Three.js 0.181.0

### Animation:
- GSAP 3.x
- ScrollTrigger plugin
- Lerp-based smooth camera

### Styling:
- Tailwind CSS v4 (@import syntax)
- Custom CSS animations (gradientShift, neonPulse, glow)
- Backdrop blur effects

### Performance:
- Turbopack (Next.js 16)
- Dynamic imports з ssr: false
- Suspense boundaries
- High-performance WebGL preset

---

## 🎯 Результат

✅ **МАКСИМАЛЬНО вражаючі 3D слайди**
✅ **Індивідуальний дизайн для кожного магазину**
✅ **Кінематографічна камера з GSAP**
✅ **Всі можливі postprocessing ефекти**
✅ **5000+ частинок + динамічні sparkles**
✅ **Преміальні UI компоненти**
✅ **Адаптивне освітлення**
✅ **Плавні transitions між слайдами**

🔥 **Клієнт ОДРАЗУ розуміє що це НЕ ДЕШЕВА КОМПАНІЯ!** 🔥
