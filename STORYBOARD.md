# 🎬 Storyboard & Animation Guide

Повний сценарій кінематографічної анімації для onecompany 3D Experience.

## 🎯 Загальна Концепція

Користувач **не просто скролить** - він **режисує фільм** про продукти через скрол. Кожен відсоток прокрутки = кадр у фільмі.

## 📊 Timeline Overview

```
0%    ━━━ Screen 1: Logo появление
20%   ━━━ Screen 2: Product reveal  
40%   ━━━ Screen 3: Inside view
60%   ━━━ Screen 4: Transformation
80%   ━━━ Screen 5: Brands showcase
100%  ━━━ Footer
```

## 🎬 Детальний Сценарій

### Screen 1: "The Entrance" (0-20% скролу)

**Що відбувається:**
```
[0%]  → Чорний екран
[5%]  → Лого "onecompany" з'являється (fade in)
[10%] → Лого на повну яскравість
[15%] → Лого починає розмиватись на частинки
[20%] → Лого повністю розпадається
```

**Камера:**
- Position: `[0, 0, 10]` (статична)
- Look at: `[0, 0, 0]`

**Код:**
```typescript
timeline
  .to('#logo-text', {
    opacity: 1,
    duration: 1,
    ease: 'power2.inOut'
  })
  .to('#logo-text', {
    opacity: 0,
    scale: 1.2,
    filter: 'blur(10px)',
    duration: 1,
  });
```

**Тип шоту:** Static establishing shot

---

### Screen 2: "The Hero" (20-40% скролу)

**Що відбувається:**
```
[20%] → З частинок збирається 3D модель койловера
[25%] → Модель повністю сформована
[30%] → Камера почала обліт навколо моделі
[35%] → Текст "Інженерія. Доведена до межі" з'являється
[40%] → Камера завершила 180° обліт
```

**Камера:**
- Start: `[0, 0, 5]`
- End: `[3, 1, 3]`
- Rotation: `y: 0 → Math.PI * 0.5`

**Код:**
```typescript
timeline
  .to(targetPosition.current, {
    x: 0,
    y: 0, 
    z: 5,
    duration: 2,
    ease: 'power1.inOut'
  })
  .to(targetPosition.current, {
    x: 3,
    y: 1,
    z: 3,
    duration: 2,
  })
  .to(targetRotation.current, {
    y: Math.PI * 0.5,
    duration: 2,
  }, '<')
  .to('#product-text', {
    opacity: 1,
    y: -20,
    duration: 1,
  }, '-=1');
```

**Тип шоту:** Dolly + Orbit (кінематографічний обліт)

**3D Ефекти:**
- Модель: легка ротація `rotation.y += 0.002`
- Освітлення: spotlight слідкує за камерою
- Particles: синхронізовано з появою моделі

---

### Screen 3: "The Details" (40-60% скролу)

**Що відбувається:**
```
[40%] → Камера "влітає" ближче до продукту
[45%] → Zoom на клапан койловера (деталь)
[50%] → Текст "Деталі, які ви не бачите"
[55%] → Камера "вилітає" назад
[60%] → Повернення до повного view
```

**Камера:**
- Zoom in: `z: 3 → 0.5` (close-up)
- Zoom out: `z: 0.5 → 4`

**Код:**
```typescript
timeline
  .to(targetPosition.current, {
    z: 0.5,
    duration: 1.5,
    ease: 'power2.in'
  })
  .to('#detail-text', {
    opacity: 1,
    duration: 1,
  }, '-=0.5')
  .to(targetPosition.current, {
    z: 4,
    x: -2,
    y: 0.5,
    duration: 2,
    ease: 'power2.out'
  });
```

**Тип шоту:** Crash zoom in + pull back

**3D Ефекти:**
- Depth of field: blur фон при zoom in
- Highlight: світло на деталі при close-up

---

### Screen 4: "The Transformation" (60-80% скролу)

**Що відбувається:**
```
[60%] → Модель койловера починає morph
[65%] → Трансформація у вихлопну систему
[70%] → Нова модель повністю сформована
[75%] → Текст "Перфоманс. Візуалізований"
[80%] → Підготовка до фінального шоту
```

**Камера:**
- Position: кругова орбіта продовжується
- Smooth transition між моделями

**Код:**
```typescript
// Морфінг (потрібен додатковий код для зміни моделей)
timeline
  .to(currentModel, {
    opacity: 0,
    scale: 0.8,
    duration: 1,
    onComplete: () => switchModel('exhaust')
  })
  .to(nextModel, {
    opacity: 1,
    scale: 1,
    duration: 1,
  })
  .to('#transform-text', {
    opacity: 1,
    duration: 1,
  });
```

**Тип шоту:** Morphing transition

**Advanced:** Використайте `MeshDistortMaterial` з drei для smooth morph effect

---

### Screen 5: "The Showcase" (80-100% скролу)

**Що відбувається:**
```
[80%] → Камера відлітає назад
[85%] → З'являється сітка з 3D моделями різних продуктів
[90%] → Текст "Наші Бренди"
[95%] → Кнопки стають інтерактивними
[100%] → Фінальний view
```

**Камера:**
- Pull back: `[0, 2, 8]`
- Look down: `rotation.x: -0.2`
- Wide shot для показу всіх брендів

**Код:**
```typescript
timeline
  .to(targetPosition.current, {
    x: 0,
    y: 2,
    z: 8,
    duration: 2,
    ease: 'power1.out'
  })
  .to(targetRotation.current, {
    y: 0,
    x: -0.2,
    duration: 2,
  }, '<')
  .to('#brands-section', {
    opacity: 1,
    y: -20,
    duration: 1.5,
    ease: 'power2.out'
  }, '-=0.5');
```

**Тип шоту:** Wide establishing shot (finale)

---

## 🎨 Додаткові Візуальні Ефекти

### Particle Effects

**Появлення моделі:**
```typescript
// Particles збираються у форму моделі
particles.forEach((particle, i) => {
  gsap.to(particle.position, {
    x: targetPositions[i].x,
    y: targetPositions[i].y,
    z: targetPositions[i].z,
    duration: 2,
    ease: 'power2.inOut'
  });
});
```

### Lighting Animation

**Синхронізація світла з камерою:**
```typescript
useFrame(() => {
  spotLight.target.position.copy(camera.position);
  spotLight.intensity = 0.5 + Math.sin(time) * 0.2;
});
```

### Post-processing (Опціонально)

```bash
npm install @react-three/postprocessing
```

```typescript
import { EffectComposer, Bloom } from '@react-three/postprocessing';

<EffectComposer>
  <Bloom intensity={0.5} luminanceThreshold={0.9} />
</EffectComposer>
```

---

## 🎵 Звук (Опціонально)

Додайте subtle звукові ефекти для immersion:

```typescript
import { useEffect } from 'react';

useEffect(() => {
  const audio = new Audio('/sounds/whoosh.mp3');
  
  // Грати звук при переході між сценами
  ScrollTrigger.create({
    trigger: containerRef.current,
    start: '20% top',
    onEnter: () => audio.play()
  });
}, []);
```

---

## 📱 Мобільна Версія

На мобільних пристроях замість interactive 3D:

1. **Запишіть анімацію як відео:**
   - Використайте screen recorder
   - Експортуйте в 1080p, 30fps
   - Формат: MP4, H.264 codec

2. **Loop video:**
```typescript
<video autoPlay loop muted playsInline>
  <source src="/videos/hero-animation.mp4" type="video/mp4" />
</video>
```

3. **Text overlays** залишаються HTML з тією самою GSAP анімацією

---

## 🎯 Performance Tips

### Оптимізація Timeline

```typescript
// Вимкніть GSAP тікери, коли не скролимо
ScrollTrigger.create({
  onUpdate: (self) => {
    if (self.progress === 1 || self.progress === 0) {
      gsap.ticker.sleep(); // Pause GSAP
    } else {
      gsap.ticker.wake(); // Resume GSAP
    }
  }
});
```

### Lazy Load моделей

```typescript
const { scene } = useGLTF('/models/coilover.glb', true, true, (loader) => {
  loader.setDRACOLoader(dracoLoader);
});

// Preload наступну модель
useEffect(() => {
  if (scrollProgress > 0.5) {
    useGLTF.preload('/models/exhaust.glb');
  }
}, [scrollProgress]);
```

---

## 🎬 Next Steps

1. **Тестуйте** кожен screen окремо
2. **Tweaking** timing (duration values)
3. **Easing** functions для smooth transitions
4. **Sound design** (опціонально)
5. **Mobile fallback** відео

**Результат:** Кінематографічний досвід, який users ніколи не забудуть! 🚀

---

Для додаткової допомоги: [GSAP Docs](https://greensock.com/docs/) | [Three.js Journey](https://threejs-journey.com/)
