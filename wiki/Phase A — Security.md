---
tags: [phase, security]
status: done
progress: 100
---

# 🔐 Phase A — Security Foundation

> [!success] Статус: **100% Готово**

---

## Що Реалізовано

### Аутентифікація
- Admin login через email / password
- Хешування паролів (bcrypt)
- Session tokens з httpOnly cookies
- Auto-logout при неактивності

### RBAC (Role-Based Access Control)
- Перевірка прав на всіх admin write-endpoints
- Middleware для захисту API routes
- Ролі: `SUPER_ADMIN`, `ADMIN`, `MANAGER`

### Сесії
- Session management з серверними cookies
- Валідація сесій на кожному запиті
- Rate limiting на auth endpoints

---

## Пов'язані Файли

| Файл | Призначення |
|---|---|
| `src/app/admin/login/page.tsx` | Сторінка входу |
| `src/lib/auth.ts` | Auth утиліти |
| `src/app/api/admin/auth/` | Auth API routes |
| `prisma/schema.prisma` | AdminUser, Role, Permission |

---

## Зв'язки

- Захищає всі endpoints → [[Phase B — Catalog]], [[Phase D — Orders]]
- RBAC потрібен для → [[Phase E — CSV Import]] (хто може імпортувати)

← [[Home]]
