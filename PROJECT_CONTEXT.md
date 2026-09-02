# DarkFlow Manager - Documento Maestro de Contexto del Proyecto

> **Fuente Única de Verdad (Single Source of Truth)**  
> **Versión del Documento:** 1.0.0  
> **Última Actualización:** 2026-09-01  
> **Estado del Proyecto:** MVP Funcional Avanzado (Fase 1 Operativa)

---

## 1. Visión y Propósito del Proyecto

**DarkFlow Manager** es un sistema ERP / POS integral full-stack especializado para **Cocinas Ocultas (Dark Kitchens / Ghost Kitchens)** que operan múltiples marcas virtuales de restaurantes desde una única ubicación física centralizada.

### Problema que Resuelve
Las cocinas multimarca tradicionales sufren de fragmentación: múltiples tablets de delivery, confusión en la asignación de comandas a la línea de cocina, descontrol en el inventario compartido de materias primas y descuadres constantes en el corte de caja físico.

### Propuesta de Valor
* **Unificación Operativa:** Un solo sistema para gestionar comandas de todas las marcas.
* **Aislamiento Multi-Tenant Estricto:** Cada marca mantiene menús, ingredientes, recetas, compras, comandas y cortes de caja independientes.
* **Explosión Automática de Insumos:** Descuento automático de materias primas al entregar un pedido según su ficha técnica (receta).
* **Control Financiero y de Caja:** Cierre de turnos con detección automática de discrepancias (faltantes/sobrantes) y desglose por canal de cobro.
* **Logística Integrada:** Despacho y asignación de pedidos listos a repartidores con monitoreo de disponibilidad.

---

## 2. Stack Tecnológico Real

| Capa | Tecnología | Versión | Propósito / Justificación |
| :--- | :--- | :--- | :--- |
| **Framework Full-Stack** | **Next.js (App Router)** | `15.1.0` | Server Components, Route Handlers (API) y renderizado optimizado. |
| **Librería de UI** | **React** | `19.0.0` | Componentes declarativos y estado de interfaz. |
| **Lenguaje** | **TypeScript** | `5.7.2` | Tipado estático estricto en frontend y backend. |
| **Estilos** | **Tailwind CSS v4** | `4.0.0` | Utilidades de estilo, diseño oscuro con *glassmorphism* y variables CSS dinámicas. |
| **ORM** | **Prisma ORM** | `5.22.0` | Modelado de datos, migraciones y cliente tipado para base de datos. |
| **Base de Datos** | **SQLite (Dev) / PostgreSQL (Prod)** | SQLite 3 | Base local en `prisma/dev.db` con soporte nativo para migrar a PostgreSQL (Supabase/Neon). |
| **Estado Global** | **Zustand** | `5.0.2` | Carrito de compras en POS, marca activa y sistema de notificaciones globales. |
| **Iconos** | **Lucide React** | `0.468.0` | Iconografía consistente y ligera. |
| **Visualización de Datos** | **Recharts** | `2.15.0` | Gráficas interactivas en el Dashboard (área, pastel, barras, líneas). |
| **Seguridad / Criptografía** | **Node.js Crypto Nativo** | Nativo | PBKDF2 para hash de contraseñas y AES-256-GCM para tokens de sesión en cookies (cero dependencias externas frágiles). |

---

## 3. Arquitectura del Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DarkFlow Architecture                           │
└────────────────────────────────────────────────────────────────────────┘

  [ Cliente Web / Navegador ]
             │ (HTTP-Only Cookie: df_session | AES-256-GCM)
             ▼
  [ Middleware de Rutas (`src/middleware.ts`) ]
             │
             ├───────────────► Páginas Públicas (`/login`)
             │
             ▼
  [ Páginas Autenticadas (App Router) ]
     ├─ Dashboard (`/`)
     ├─ POS Delivery (`/pos`)
     ├─ Kitchen KDS (`/kitchen`)
     ├─ Menú & Catálogo (`/menu`)
     ├─ Inventarios (`/inventory`)
     ├─ Corte de Caja (`/cash`)
     └─ Choferes (`/drivers`)
             │
             ▼ (Llamadas Fetch internas a Route Handlers)
  [ API Route Handlers (`src/app/api/*`) ]
     ├─ `/api/auth/*`      (login, logout, me, brand switch)
     ├─ `/api/brands`      (marcas asignadas, creación y edición)
     ├─ `/api/categories`  (secciones del menú por marca)
     ├─ `/api/products`    (catálogo, CRUD y disponibilidad por marca)
     ├─ `/api/orders/*`    (creación, avance de estado y descuento de stock)
     ├─ `/api/inventory`   (insumos, compras y mapeo de recetas)
     ├─ `/api/cash`        (apertura/cierre de caja y agregados de ventas)
     ├─ `/api/drivers`     (perfiles y disponibilidad de choferes)
     └─ `/api/dashboard`   (KPIs, analíticas y comparativa multi-marca)
             │
             ▼ (Prisma Client Singleton: `src/lib/db.ts`)
  [ Base de Datos Relacional: SQLite / PostgreSQL ]
```

---

## 4. Modelo de Datos y Entidades (Prisma)

El esquema relacional en [`prisma/schema.prisma`](file:///prisma/schema.prisma) define las siguientes entidades:

1. **`User`**: Usuarios del sistema (`id`, `email`, `passwordHash`, `name`, `role`, `createdAt`, `updatedAt`).
2. **`Brand`**: Marcas virtuales de cocina (`id`, `name`, `slug`, `logoUrl`, `primaryColor`, `secondaryColor`, `isActive`).
3. **`UserBrand`**: Tabla intermedia de pertenencia de usuarios a marcas (N:M).
4. **`Category`**: Categorías de productos agrupadas por marca.
5. **`Product`**: Platillos en el menú pertenecientes a una categoría y marca (`id`, `name`, `description`, `price`, `imageUrl`, `isActive`).
6. **`Ingredient`**: Insumos o materias primas (`id`, `name`, `stock`, `unit`, `cost`, `minStock`, `brandId`).
7. **`RecipeItem`**: Ficha técnica que vincula `Product` con `Ingredient` indicando `quantity` utilizada por unidad vendida.
8. **`Order`**: Comandas de pedidos (`id`, `orderNumber`, `source`, `status`, `customerName`, `customerPhone`, `customerAddress`, `notes`, `subtotal`, `tax`, `tip`, `total`, `driverId`, `brandId`).
9. **`OrderItem`**: Líneas de producto dentro de una comanda (`orderId`, `productId`, `quantity`, `price`, `notes`).
10. **`Purchase`**: Registro histórico de compras de mercancía (`ingredientId`, `quantity`, `cost`, `supplier`, `purchaseDate`, `brandId`).
11. **`CashSession`**: Turnos de caja / arqueos (`brandId`, `userId`, `openedAt`, `closedAt`, `openingBalance`, `closingBalance`, `expectedBalance`, `actualBalance`, `cashSales`, `cardSales`, `appsSales`, `status`, `notes`).
12. **`DeliveryProfile`**: Perfil operativo de repartidores vinculado a un `User` (`vehicleType`, `plateNumber`, `status`).

---

## 5. Control de Acceso y Roles (RBAC)

Los roles soportados y sus permisos son:

| Rol | Alcance de Marcas | Permisos de Navegación |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Todas las marcas registradas | Acceso total: Dashboard comparativo, POS, KDS, Inventario, Caja, Repartidores y selector libre de cualquier marca. |
| **`BRAND_ADMIN`** | Solo las marcas vinculadas en `UserBrand` | Dashboard de su marca, POS, KDS, Inventario, Caja, Repartidores. |
| **`CASHIER`** | Marcas vinculadas | POS Ventas, Corte de Caja, Repartidores. |
| **`KITCHEN`** | Marcas vinculadas | Pantalla de Cocina (KDS). |
| **`DELIVERY`** | No accede a panel administrativo | Perfil de chofer, estado de entrega. |

---

## 6. Módulos Operativos y Flujos de Negocio

### 6.1. Autenticación y Cambio de Marca en Caliente
* El token de sesión `df_session` se cifra simétricamente con AES-256-GCM conteniendo `{ userId, email, name, role, brandIds, activeBrandId, expiresAt }`.
* Al cambiar de cocina en el selector de la barra superior, se invoca `POST /api/auth/me` con el nuevo `brandId`. La cookie se re-cifra y se actualiza el tema visual `--brand-primary` en tiempo real.

### 6.2. Ciclo de Vida de una Comanda (`Order`)
```
[ POS Ventas: Creación ] ──► Estado: RECEIVED
                                   │
                                   ▼ (KDS Cocina: Avanzar a preparación)
                             Estado: PREPARING
                                   │
                                   ▼ (KDS Cocina: Finalizar cocción)
                             Estado: READY
                                   │
                                   ▼ (Módulo Choferes: Asignar repartidor)
                             Estado: ON_THE_WAY
                                   │
                                   ▼ (Módulo Choferes: Marcar entregado)
                             Estado: DELIVERED
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
    [ Transacción en Base de Datos ]        [ Registro en Caja ]
    Descuenta de `Ingredient.stock`          Suma a `CashSession`
    según `RecipeItem` de cada plato        según el canal (Efectivo/Tarjeta/Apps)
```

### 6.3. Verificación Previa de Stock en POS
El POS valida si hay inventario suficiente para preparar el plato antes de agregarlo al carrito, mostrando alertas como `Sin Carne de Res (1.2/0.2 kg)` si el stock es insuficiente.

### 6.4. Corte de Caja y Auditoría
* Para poder registrar cobros, se inicia una sesión de caja con fondo base (`openingBalance`).
* Al cerrar turno, el sistema suma automáticamente las órdenes en estado `DELIVERED` durante el periodo del turno y calcula el saldo esperado (`openingBalance + cashSales`).
* Si el cajero introduce un valor distinto, el sistema calcula la **discrepancia** (Faltante o Sobrante) y la almacena en el registro de auditoría.

---

## 7. Estructura del Código y Convenciones

```
darkflow/
├── prisma/
│   ├── schema.prisma         # Esquema de datos y relaciones
│   ├── seed.ts               # Sembrado de datos demo iniciales
│   └── dev.db                # Base de datos SQLite local
├── public/                   # Activos públicos y logotipos
├── src/
│   ├── app/
│   │   ├── api/              # Route Handlers (Backend REST)
│   │   │   ├── auth/         # Login, logout, me
│   │   │   ├── brands/       # Consulta de marcas por rol
│   │   │   ├── cash/         # Sesiones y cortes de caja
│   │   │   ├── dashboard/    # KPIs y datos de gráficas
│   │   │   ├── drivers/      # Perfiles y estados de repartidores
│   │   │   ├── inventory/    # Insumos, compras y recetas
│   │   │   ├── orders/       # Listado, creación y actualización de pedidos
│   │   │   └── products/     # Catálogo de productos por marca
│   │   ├── cash/page.tsx     # Vista de Corte de Caja
│   │   ├── drivers/page.tsx  # Vista de Despacho y Choferes
│   │   ├── inventory/page.tsx# Vista de Almacén, Compras y Fichas Técnicas
│   │   ├── kitchen/page.tsx  # Vista KDS de Cocina
│   │   ├── login/page.tsx    # Vista de Login con accesos demo
│   │   ├── page.tsx          # Vista de Dashboard Principal
│   │   ├── pos/page.tsx      # Vista de Punto de Venta Delivery
│   │   ├── globals.css       # Estilos globales y tokens de Tailwind v4
│   │   └── layout.tsx        # Layout raíz con BrandThemeProvider
│   ├── components/
│   │   ├── BrandThemeProvider.tsx # Inyector de variables CSS de marca
│   │   └── DashboardContainer.tsx # Layout con Sidebar, Topbar y Selector
│   ├── lib/
│   │   ├── auth.ts           # Cifrado/Descifrado de sesión AES-256-GCM
│   │   ├── db.ts             # Instancia singleton de Prisma Client
│   │   ├── hash.ts           # Hash y verificación PBKDF2 de contraseñas
│   │   └── store.ts          # Estado global Zustand (Carrito, Brand, Toasts)
│   └── middleware.ts         # Protección perimetral de rutas privadas
├── .gitignore
├── package.json
├── README.md
└── tsconfig.json
```

---

## 8. Reglas de Continuidad y Buenas Prácticas

1. **Respeto a la Arquitectura Multi-Tenant:** Cualquier nueva consulta o mutación a la base de datos DEBE filtrar por `brandId` del usuario en sesión, excepto para vistas globales exclusivas de `SUPER_ADMIN`.
2. **Atomicidad en Inventarios:** El descuento de stock de insumos por receta siempre debe ejecutarse dentro de un `$transaction` de Prisma para garantizar consistencia.
3. **Cero Dependencias Inseguras:** Mantener la sesión basada en cookies HTTP-Only nativas de Node Crypto y evitar paquetes externos pesados para auth.
4. **Tipado Estricto:** Evitar el uso de `any` en TypeScript; definir interfaces o usar tipos inferidos de Prisma.
5. **Evolución sin Romper:** No reescribir módulos funcionales existentes; extender mediante componentes o campos adicionales documentados.

---

## 9. Roadmap de Fases Posteriores

* **Fase 2 (Próxima):**
  - CRUD administrativo completo en UI para Marcas, Categorías y Productos.
  - Soporte de Restaurante Físico (Entidad `Table`, asignación de meseros y flujo `ORDERED` ➔ `PREPARING` ➔ `READY` ➔ `SERVED`).
* **Fase 3:**
  - Migración oficial a PostgreSQL en la nube (Supabase / Neon).
  - Comunicación en tiempo real mediante Server-Sent Events (SSE) o WebSockets para el KDS de cocina.
  - Suite de pruebas automatizadas (Playwright / Vitest).
