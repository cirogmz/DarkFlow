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
     ├─ POS Ventas & Salón (`/pos`)
     ├─ Salón & Mesas (`/tables`)
     ├─ Kitchen KDS (`/kitchen`)
     ├─ Menú & Catálogo (`/menu`)
     ├─ Inventarios (`/inventory`)
     ├─ Corte de Caja (`/cash`)
     ├─ Clientes & Puntos CRM (`/customers`)
     ├─ Choferes (`/drivers`)
     ├─ Personal & Roles (`/users`)
     └─ Reportes & Exportar (`/reports`)
             │
             ▼ (Llamadas Fetch internas a Route Handlers)
  [ API Route Handlers (`src/app/api/*`) ]
     ├─ `/api/auth/*`      (login, logout, me, brand switch)
     ├─ `/api/brands`      (marcas asignadas, creación y edición)
     ├─ `/api/categories`  (secciones del menú por marca)
     ├─ `/api/products`    (catálogo, CRUD y disponibilidad por marca)
     ├─ `/api/tables`      (mesas de salón, capacidad y comensales)
     ├─ `/api/users`       (personal, roles RBAC y asignación de marcas)
     ├─ `/api/reports`     (reportes financieros, caja, inventario y CSV)
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
4. **`Table`**: Mesas del salón físico (`id`, `number`, `name`, `capacity`, `status`, `zone`, `brandId`). Estados: `AVAILABLE`, `OCCUPIED`, `BILL_REQUESTED`, `RESERVED`.
5. **`Category`**: Categorías de productos agrupadas por marca.
6. **`Product`**: Platillos en el menú pertenecientes a una categoría y marca (`id`, `name`, `description`, `price`, `imageUrl`, `isActive`).
7. **`Ingredient`**: Insumos o materias primas (`id`, `name`, `stock`, `unit`, `cost`, `minStock`, `brandId`).
8. **`RecipeItem`**: Ficha técnica que vincula `Product` con `Ingredient` indicando `quantity` utilizada por unidad vendida.
9. **`Order`**: Comandas de pedidos (`id`, `orderNumber`, `source`, `status`, `customerName`, `customerPhone`, `customerAddress`, `notes`, `subtotal`, `tax`, `tip`, `total`, `driverId`, `brandId`, `tableId`, `diners`). Orígenes: `WEB`, `PHONE`, `UBER_EATS`, `RAPPI`, `DINE_IN`, `TAKEAWAY`.
10. **`Customer`**: Clientes y CRM de fidelización (`id`, `name`, `phone`, `email`, `address`, `notes`, `totalOrders`, `totalSpent`, `loyaltyPoints`, `brandId`).
11. **`OrderItem`**: Líneas de producto dentro de una comanda (`orderId`, `productId`, `quantity`, `price`, `notes`).
12. **`Purchase`**: Registro histórico de compras de mercancía (`ingredientId`, `quantity`, `cost`, `supplier`, `purchaseDate`, `brandId`).
13. **`CashSession`**: Turnos de caja / arqueos (`brandId`, `userId`, `openedAt`, `closedAt`, `openingBalance`, `closingBalance`, `expectedBalance`, `actualBalance`, `cashSales`, `cardSales`, `appsSales`, `status`, `notes`).
14. **`DeliveryProfile`**: Perfil operativo de repartidores vinculado a un `User` (`vehicleType`, `plateNumber`, `status`).
15. **`Coupon`**: Cupones de descuento configurables (`id`, `code`, `description`, `discountType`, `discountValue`, `minOrderAmount`, `maxDiscount`, `usageLimit`, `usedCount`, `startDate`, `endDate`, `isActive`, `brandId`).
16. **`Combo`**: Paquetes de platillos promocionales (`id`, `name`, `description`, `price`, `imageUrl`, `isActive`, `brandId`, `items`).
17. **`ComboItem`**: Detalle de productos y cantidades que componen un `Combo` (`comboId`, `productId`, `quantity`).

---

## 5. Control de Acceso y Roles (RBAC)

Los roles soportados y sus permisos son:

| Rol | Alcance de Marcas | Permisos de Navegación |
| :--- | :--- | :--- |
| **`SUPER_ADMIN`** | Todas las marcas registradas | Acceso total: Dashboard comparativo, POS, Salón & Mesas, KDS, Menú & Catálogo, Inventario, Caja, Clientes & Puntos CRM, Repartidores, Personal & Roles, Reportes & Exportar y selector libre de cualquier marca. |
| **`BRAND_ADMIN`** | Solo las marcas vinculadas en `UserBrand` | Dashboard de su marca, POS, Salón & Mesas, KDS, Menú & Catálogo, Inventario, Caja, Clientes & Puntos CRM, Repartidores, Personal & Roles y Reportes & Exportar. |
| **`CASHIER`** | Marcas vinculadas | POS Ventas, Salón & Mesas, Corte de Caja, Clientes & Puntos CRM, Repartidores. |
| **`KITCHEN`** | Marcas vinculadas | Pantalla de Cocina (KDS). |
| **`DELIVERY`** | Marcas vinculadas | Perfil de chofer, asignación de pedidos en `/drivers`. |

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

### 6.5. Impresión Térmica ESC/POS y Comandas
* El componente [`ThermalTicketModal`](file:///src/components/ThermalTicketModal.tsx) provee generación nativa de tickets térmicos adaptados a mini-impresoras estándar:
  - **Anchos configurables:** `58mm` (móvil/Bluetooth) y `80mm` (mostrador/USB).
  - **Modo Comanda de Cocina (KOT):** Folio destacado, mesa/origen, tiempo de espera, lista de platillos en negrita y notas operativas.
  - **Modo Cuenta / Cliente:** Encabezado con datos fiscales demo, desglose con precio unitario, subtotal, IVA 16%, saldo de puntos de lealtad y sugerencia de propinas voluntarias (10%, 15%, 20%).
  - Estilos de impresión aislados `@media print` para evitar márgenes y cabeceras del navegador.

### 6.6. Clientes & Fidelización CRM (`/customers`)
* **Base de Clientes Unificada:** Registro de clientes con número telefónico único, nombre, correo, dirección habitual de entrega y notas de preferencias/alergias.
* **Programa de Puntos de Lealtad:** Acumulación automática de 1 punto por cada $10 MXN de consumo en pedidos finalizados (`Math.floor(total / 10)`).
* **Auto-completado Inteligente en POS:** Búsqueda en tiempo real por teléfono o nombre durante el checkout para auto-llenar datos de entrega y notas.
* **Canje de Puntos:** Descuento directo en el carrito de compras a razón de 10 puntos = $1 MXN de descuento.
* **Clasificación VIP:** Clientes con 3 o más pedidos reciben automáticamente el distintivo `VIP` con métricas de LTV y ticket promedio.

### 6.7. Sincronización en Tiempo Real (SSE) & Chime Sonoro (`/kitchen` & `/drivers`)
* **Server-Sent Events (SSE) Unidireccional (`/api/orders/stream`):** Flujo de eventos HTTP en tiempo real con bajas latencias para actualización instantánea de comandas.
* **Gestión de Eventos Reactiva (`src/lib/events.ts`):** `EventEmitter` centralizado que emite `order_event` en creación de pedidos (`CREATED`) y transiciones de estado (`STATUS_CHANGED`).
* **Sintetizador de Campana Web Audio API (`src/lib/sound.ts`):** Generación procedural de doble tono armónico (880 Hz ➔ 1320 Hz) tipo campana de cocina sin requerir dependencias externas ni descargar archivos de audio.
* **Temporizadores Vivos en KDS:** Contadores segundo a segundo con código de semáforo de urgencia:
  - Verde (< 10 min): En tiempo normal.
  - Ámbar (10-20 min): Atención requerida.
  - Rojo pulsante (> 20 min): Comanda demorada con icono de advertencia.
* **Tablero de Despacho en Vivo:** Entrada inmediata de pedidos en estado `READY` para asignación de chofer con timbre auditivo de aviso.

---

## 7. Estructura del Código y Convenciones

```
darkflow/
├── prisma/
│   ├── schema.prisma         # Esquema de datos y relaciones (User, Brand, Table, Customer, Order, etc.)
│   ├── seed.ts               # Sembrado de datos demo iniciales
│   └── dev.db                # Base de datos SQLite local
├── public/                   # Activos públicos y logotipos
├── src/
│   ├── app/
│   │   ├── api/              # Route Handlers (Backend REST)
│   │   │   ├── auth/         # Login, logout, me
│   │   │   ├── brands/       # Consulta y creación de marcas
│   │   │   ├── cash/         # Sesiones y cortes de caja
│   │   │   ├── categories/   # Secciones de menú
│   │   │   ├── customers/    # CRM de clientes y puntos de fidelidad
│   │   │   ├── dashboard/    # KPIs y datos de gráficas
│   │   │   ├── drivers/      # Perfiles y estados de repartidores
│   │   │   ├── inventory/    # Insumos, compras y recetas
│   │   │   ├── orders/       # Listado, creación, ciclo de vida y stream SSE de pedidos
│   │   │   ├── products/     # Catálogo de platillos por marca
│   │   │   ├── reports/      # Agregados para reportes financieros y de inventario
│   │   │   ├── tables/       # Mesas físicas, estados y comensales
│   │   │   └── users/        # Gestión de personal, credenciales y RBAC
│   │   ├── cash/page.tsx     # Vista de Corte de Caja
│   │   ├── customers/page.tsx# Vista CRM de Clientes & Puntos de Fidelidad
│   │   ├── drivers/page.tsx  # Vista de Despacho y Choferes (En Vivo SSE)
│   │   ├── inventory/page.tsx# Vista de Almacén, Compras y Fichas Técnicas
│   │   ├── kitchen/page.tsx  # Vista KDS de Cocina en Tiempo Real (SSE + Campana)
│   │   ├── login/page.tsx    # Vista de Login con accesos demo
│   │   ├── menu/page.tsx     # Vista de Catálogo y Menú Digital
│   │   ├── page.tsx          # Vista de Dashboard Principal
│   │   ├── pos/page.tsx      # Vista de Punto de Venta con CRM y Recibo Térmico
│   │   ├── reports/page.tsx  # Vista de Reportes con Exportación a Excel/CSV
│   │   ├── tables/page.tsx   # Vista de Salón y Mesas con Pre-cuenta Térmica
│   │   ├── users/page.tsx    # Vista de Administración de Personal & Roles
│   │   ├── globals.css       # Estilos globales y tokens de Tailwind v4
│   │   └── layout.tsx        # Layout raíz con BrandThemeProvider
│   ├── components/
│   │   ├── BrandThemeProvider.tsx # Inyector de variables CSS de marca
│   │   ├── DashboardContainer.tsx # Layout con Sidebar, Topbar y Selector
│   │   └── ThermalTicketModal.tsx # Generador universal de tickets térmicos ESC/POS
│   ├── lib/
│   │   ├── auth.ts           # Cifrado/Descifrado de sesión AES-256-GCM
│   │   ├── db.ts             # Instancia singleton de Prisma Client
│   │   ├── events.ts         # Singleton de EventEmitter para eventos reactivos
│   │   ├── hash.ts           # Hash y verificación PBKDF2 de contraseñas
│   │   ├── sound.ts          # Sintetizador Web Audio API de campanas KDS
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

## 9. Estado Actual y Roadmap de Fases

* ✅ **Fase 1 (Completada):** Core Foundations & Multi-Brand Hub.
* ✅ **Fase 2 (Completada):** Salón Físico, Mapa de Mesas y Pre-cuentas.
* ✅ **Fase 3 (Completada):** Personal, Roles y Control de Acceso (RBAC).
* ✅ **Fase 4 (Completada):** Reportes Financieros y Exportación a Excel/CSV.
* ✅ **Fase 5 (Completada):** Impresión Térmica ESC/POS de Comandas y Recibos (58mm/80mm).
* ✅ **Fase 6 (Completada):** Módulo de Clientes & Programa de Puntos de Lealtad (CRM).
* ✅ **Fase 7 (Completada):** Sincronización en Tiempo Real (SSE + Campana Sonora) para KDS y Despacho.
* ✅ **Fase 8 (Completada):** Promociones Comerciales, Cupones de Descuento y Combos Dinámicos.
* 🔄 **Fase 9 (Siguiente):**
  - Webhooks y Simulador de Delivery Apps Externas (Uber Eats, Rappi, Didi Food con comisiones).
  - Migración a PostgreSQL en producción (Supabase / Neon / Cloud SQL).
  - Exportaciones PDF avanzadas y facturación CFDI.
