# DarkFlow Manager - Documento Maestro de Contexto del Proyecto

> **Fuente Única de Verdad (Single Source of Truth)**  
> **Versión del Documento:** 1.19.0  
> **Última Actualización:** 2026-09-18  
> **Estado del Proyecto:** KDS Avanzado con Semáforos SLA y Tiempos de Servicio (Fase 19 Operativa)

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
14. **`CashMovement`**: Entradas de cambio y sangrías/retiros de seguridad de efectivo vinculados al turno (`id`, `sessionId`, `type`, `amount`, `reason`, `authorizedBy`, `createdAt`).
15. **`CashCut`**: Registro inmutable de arqueos parciales (Corte X) y cierres definitivos (Corte Z) con desglose de denominaciones (`id`, `sessionId`, `type`, `cutNumber`, `expectedAmount`, `actualAmount`, `difference`, `denominations`, `salesSummary`, `createdAt`).
16. **`GiftCard`**: Tarjetas de regalo, saldo prepago y monederos digitales (`id`, `brandId`, `code`, `initialBalance`, `currentBalance`, `pinHash`, `status`, `notes`).
17. **`GiftCardTransaction`**: Kardex y auditoría de débitos y recargas de tarjetas de regalo (`id`, `giftCardId`, `type`, `amount`, `balanceBefore`, `balanceAfter`, `orderId`, `notes`).
18. **`DeliveryProfile`**: Perfil operativo de repartidores vinculado a un `User` (`vehicleType`, `plateNumber`, `status`).
19. **`Coupon`**: Cupones de descuento configurables (`id`, `code`, `description`, `discountType`, `discountValue`, `minOrderAmount`, `maxDiscount`, `usageLimit`, `usedCount`, `startDate`, `endDate`, `isActive`, `brandId`).
20. **`Combo`**: Paquetes de platillos promocionales (`id`, `name`, `description`, `price`, `imageUrl`, `isActive`, `brandId`, `items`).
21. **`ComboItem`**: Detalle de productos y cantidades que componen un `Combo` (`comboId`, `productId`, `quantity`).
22. **`InventoryAudit`**: Auditorías físicas de inventario y arqueos ciegos (`id`, `brandId`, `auditNumber`, `type`, `status`, `warehouseId`, `totalExpectedValue`, `totalCountedValue`, `totalDiscrepancyValue`, `notes`, `conductedById`, `appliedAt`, `createdAt`).
23. **`InventoryAuditItem`**: Detalle de insumos contados en el arqueo físico (`id`, `auditId`, `ingredientId`, `expectedStock`, `countedStock`, `discrepancy`, `unitCost`, `discrepancyCost`, `notes`).
24. **`InternalRequisition`**: Requisiciones internas y transferencias inter-bodegas/compras (`id`, `brandId`, `folio`, `type`, `urgency`, `status`, `fromWarehouseId`, `toWarehouseId`, `requestedById`, `approvedById`, `dispatchedById`, `dispatchGuide`, `receivedById`, `totalEstimatedCost`, `totalDiscrepancyCost`, `notes`, `rejectionReason`).
25. **`RequisitionItem`**: Detalle de insumos solicitados, autorizados, despachados y recibidos con cálculo de discrepancias (`id`, `requisitionId`, `ingredientId`, `requestedQty`, `approvedQty`, `dispatchedQty`, `receivedQty`, `discrepancyQty`, `unitCost`, `notes`).

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

### 6.10. Facturación Comercial y Comprobantes en PDF (Carta / A4)
* Componente `InvoicePdfModal` universal para emisión y vista previa de Facturas Fiscales (representación digital CFDI) y Comprobantes Simples de Venta / Notas de Venta.
* Generador de importe con letra en español (`numberToSpanishWords`), desglose de IVA (16%), descuentos comerciales (cupones y programa de lealtad), propinas y totales.
* Impresión vectorial y descarga nativa a PDF mediante CSS Paged Media `@media print { size: letter portrait; }` sin dependencias de servidor pesadas.
* Acceso directo desde la tabla de ventas de `/reports` (botón de factura por comanda) y desde la confirmación de pedido en `/pos`.

### 6.11. Producción, PostgreSQL y Contenerización Docker
* **Soporte Dual de Base de Datos**: SQLite nativo local (`prisma/schema.sqlite.prisma`) y PostgreSQL para producción (`prisma/schema.postgresql.prisma`) compatible con Supabase, Neon, AWS RDS, Cloud SQL o Docker Compose.
* **Script de Conmutación Transparente**: `npm run db:use:pg` y `npm run db:use:sqlite` mediante `scripts/switch-db.js`.
* **Empaquetado Standalone**: Configuración de `next.config.ts` con `output: 'standalone'` que reduce el tamaño del contenedor a <180MB.
* **Orquestación Completa**: `docker-compose.yml` con servicio `darkflow-postgres` (PostgreSQL 16 Alpine con healthcheck y volumen persistente) y `darkflow-app` (Next.js con script de auto-migración `docker-entrypoint.sh`).
* **Sonda de Salud Operativa**: Endpoint GET `/api/health` con test activo de consulta SQL y medición de latencia para Kubernetes / Cloud Run.

### 6.12. Menú Digital QR y Auto-Pedido Móvil para Comensales
* **Experiencia de Auto-Servicio sin Registro**: Ruta pública `/m/[slug]` accesible mediante escaneo de código QR en mesa o enlace web directo.
* **Tematización Dinámica de Marca**: Personalización en vivo de logotipo, paleta de colores (`primaryColor`), categorías, platillos y paquetes de combos promocionales.
* **Carrito y Notas de Cocina**: Comanda personalizada con especificaciones por platillo ("sin cebolla", "término medio"), cupones de descuento y asignación de mesa física.
* **Integración Instantánea con Cocina KDS**: Los pedidos colocados emiten el evento reactivo SSE `orderEvents.emit('order_event', { action: 'CREATED' })`, disparando la campana sonora del KDS y actualizando el estado de la mesa a `OCCUPIED`.
* **Pantalla de Seguimiento en Vivo**: Ruta `/order-tracking/[id]` con stepper de 4 etapas (`RECEIVED` ➔ `PREPARING` ➔ `READY` ➔ `DELIVERED`), refresco automático y desglose de ticket.
* **Generador de QR en Salón**: En `/tables`, cada mesa cuenta con un botón para desplegar e imprimir la tarjeta QR con el enlace directo `http://<host>/m/[slug]?table=[number]`.

### 6.13. Registro de Auditoría y Trazabilidad Forense (`/audit`)
* **Bitácora Inmutable (`AuditLog`)**: Registro estructurado de eventos de alta sensibilidad con niveles de severidad (`INFO`, `WARNING`, `CRITICAL`), actor (`userId`), marca (`brandId`), `ipAddress` del cliente y diferencias (`details` JSON).
* **Instrumentación Automática de Endpoints**:
  - `/api/orders/[id]`: Cancelación forzada de órdenes (`ORDER_CANCELLED`, CRITICAL) y transiciones de estado.
  - `/api/cash`: Apertura de turno (`CASH_SESSION_OPENED`, INFO) y cierre con arqueo (`CASH_SESSION_CLOSED`, CRITICAL si diferencia > $0.50, de lo contrario INFO).
  - `/api/inventory`: Ajustes manuales de existencias (`STOCK_ADJUSTED`, WARNING), compras de almacén (`PURCHASE_RECORDED`, INFO) y creación de insumos (`INGREDIENT_CREATED`, INFO).
  - `/api/users`: Creación (`USER_CREATED`, INFO), cambios de rol administrativo (`USER_ROLE_CHANGED`, CRITICAL) y bajas de cuentas (`USER_DELETED`, CRITICAL).
* **Módulo de Gestión Forense (`/audit`)**:
  - KPIs de seguridad con tarjetas de conteo de eventos totales, críticos, advertencias e informativos.
  - Filtros en tiempo real por severidad, entidad (`ORDER`, `CASH_SESSION`, `INGREDIENT`, `PURCHASE`, `USER`), búsqueda textual y rango de fechas.
  - Modal de inspección profunda con visualización de payload JSON con formato indentado.
  - Exportación completa o filtrada a formato CSV con un clic.
  - Control de acceso RBAC estricto exclusivo para `SUPER_ADMIN` y `BRAND_ADMIN`.

### 6.14. Pasarelas de Pago Digitales Integradas (Stripe & Mercado Pago)
* **Modelo de Datos y Transacciones Multi-Tenant**:
  - Modelo `PaymentTransaction` con trazabilidad completa de `gateway` (`STRIPE`, `MERCADOPAGO`, `SANDBOX`), `status` (`PENDING`, `COMPLETED`, `FAILED`), montos, identificadores remotos de sesión/orden y respuesta cruda JSON.
  - Campos ampliados en `Brand` para claves API (`stripeSecretKey`, `stripePublicKey`, `stripeWebhookSecret`, `mpAccessToken`, `mpPublicKey`, `mpWebhookSecret`), interruptor de `paymentSandboxMode` y `allowOnlinePayments`.
  - Campos de pago en `Order`: `paymentStatus` (`PENDING`, `PAID`, `REFUNDED`), `paymentMethod` (`CASH`, `TERMINAL`, `STRIPE`, `MERCADOPAGO`), `paidAt` y `paymentTransactionId`.
* **Arquitectura Dual (Producción REST + Simulador Sandbox)**:
  - Soporte para claves reales de Stripe (Checkout Sessions vía REST) y Mercado Pago (Preferencias vía REST) sin SDKs binarios pesados.
  - Modo Sandbox con simulador interactivo de 1-clic que aprueba órdenes de prueba con total realismo y sin costo de procesamiento bancario.
* **Flujos de Cobro Implementados**:
  - **Menú Móvil del Comensal (`/m/[slug]`)**: Selector de forma de pago (*Efectivo / Mesero*, *Tarjeta con Stripe*, *Mercado Pago*). Modal de pago en línea integrado con redirección y simulador sandbox de auto-aprobación.
  - **Caja del Punto de Venta (`/pos`)**: Cobro en mostrador con selector dinámico. Al elegir Stripe o Mercado Pago, se despliega un modal con Código QR interactivo (`qrserver.com`) para escanear con el smartphone del cliente, botón para copiar el link directo para envío por WhatsApp, y botón de confirmación inmediata.
  - **Rastreo de Comanda en Vivo (`/order-tracking/[id]`)**: Indicador de estado de pago con badge verde (*PAGADO*) o advertencia con botones para liquidar en línea con Stripe o Mercado Pago.
  - **Hub de Integraciones (`/integrations`)**: Pestaña dedicada "Pasarelas de Pago" con captura protegida y enmascarada de credenciales, switches de sandbox y pagos en línea, visualizador y copiado de Webhook URL unificado (`/api/webhooks/payments`), y simulador de prueba de eventos entrantes.
* **Conciliación Reactiva en Tiempo Real**:
  - Endpoint receptor unificado de Webhooks (`/api/webhooks/payments`) con soporte para firmas y eventos de Stripe y Mercado Pago.
  - Confirmación atómica de orden (`confirmOrderPayment`), actualización a `paymentStatus: 'PAID'`, emisión de evento reactivo Server-Sent Events (SSE) `orderEvents.emit('order_event', { action: 'PAID' })`, actualización instantánea en KDS/POS y registro de auditoría forense inmutable (`ORDER_PAID`, `INFO`).

### 6.15. Operativa de Salón Avanzada (Cuentas Divididas, Fusión/Cambio de Mesas y Control de Propinas)
* **Cuentas Divididas y Pagos Parciales (Split Bills)**:
  - Soporte de pagos divididos en dos modalidades: **Partes Iguales ($N$ comensales)** y **Por Platillos Consumidos** con asignación interactiva.
  - Endpoint transaccional `POST /api/orders/split-payment` que acumula abonos en `PaymentTransaction` con `splitIndex`, actualiza `paidAmount` en `Order` y, al liquidar el saldo total, marca la comanda como `PAID`, libera automáticamente la mesa en el salón y emite el evento SSE `action: 'PAID'`.
  - Componente modal `SplitBillModal` en `/pos` con barra de progreso en vivo del cobro, desglose por comensal, selector de método de pago por abono (Efectivo, Terminal, Stripe, Mercado Pago) y registro de propinas individuales.
  - Soporte en tickets térmicos (`ThermalTicketModal`) para imprimir el desglose de abonos registrados y propinas recibidas.
* **Reubicación y Fusión Atómica de Mesas (Table Transfer & Merge)**:
  - **Mover Comanda (`POST /api/tables/transfer`)**: Reubica comensales y comanda activa desde una mesa ocupada a cualquier mesa disponible del salón, actualizando sus estados (`AVAILABLE` / `OCCUPIED`), emitiendo evento SSE y registrando auditoría forense (`TABLE_TRANSFERRED`).
  - **Unir Cuentas (`POST /api/tables/merge`)**: Fusiona atómicamente los platillos de dos mesas ocupadas en una sola comanda destino, recalcula subtotal, IVA y total, cancela la orden origen, libera la mesa secundaria y registra auditoría (`TABLE_MERGED`).
* **Control y Reparto de Propinas (Tip Pool)**:
  - Botones de propina rápida configurable (`0%`, `10%`, `15%`, `20%` y monto libre `$`) integrados tanto en el pie del carrito como en el modal de checkout de `/pos`.
  - Agregación automática de propinas discriminadas por método (`tipsCash`, `tipsCard`, `tipsTotal`) en el arqueo y cierre de caja (`CashSession`) en `/api/cash`.
  - Algoritmo de reparto equitativo del pozo de propinas en `/cash`: 70% para meseros/piso, 20% para cocina y 10% para barra.

### 6.16. Modificadores Avanzados, Grupos de Extras y Términos de Cocina
* **Catálogo de Modificadores (`ModifierGroup` y `ModifierOption`)**:
  - Modelos relacionales con validación de mínimos (`minSelect`, 0 = opcional, 1+ = obligatorio) y máximos (`maxSelect`, 1 = radio única, >1 = checkboxes hasta el límite).
  - Precios adicionales por opción (+$0.00 para términos de carne o +$XX.00 para extras/toppings) y enlace opcional a insumos de inventario (`ingredientId`, `ingredientQuantity`) para descuento automático de stock.
  - Asociación flexible a productos del menú mediante `ProductModifierGroup`.
* **Experiencia POS y Menú Digital QR (`/pos` & `/m/[slug]`)**:
  - Modal interactivo de personalización (`ProductCustomizeModal`) con validación de selecciones obligatorias antes de agregar al carrito.
  - Carrito lateral con desglose visual de modificadores y recálculo automático de precio unitario.
* **Visualización en KDS de Cocina (`/kitchen`) y Tickets ESC/POS**:
  - Badges de alto contraste en las comandas de cocina (`[Término: Tres Cuartos]`, `[+ Tocino (+$25.00)]`) para lectura instantánea de la brigada de cocina.
  - Desglose en `ThermalTicketModal`, `InvoicePdfModal` y pantalla de rastreo `/order-tracking/[id]`.
* **Descuento Atómico de Inventario**:
  - Al marcar comanda como `DELIVERED`, descuenta del almacén tanto la receta base como los insumos asociados a los modificadores elegidos en una única transacción de Prisma.

### 6.17. Almacén y Costeo Avanzado (Sub-recetas, Mermas y Múltiples Bodegas)
* **Sub-recetas Multinivel y Fichas Técnicas (`SubRecipeItem`)**:
  - Definición de alimentos preparados (salsas, aderezos, masas de pizza) a partir de insumos base, con factor de rendimiento neto (`yieldQuantity`, `yieldUnit`) y recálculo automático de costo unitario ponderado.
  - Órdenes de producción en cocina (`ProductionBatch`): al preparar un lote, se valida el stock disponible, se descuenta la materia prima base y se incrementa el insumo terminado atómicamente.
* **Bitácora y Control de Mermas Operativas (`WasteLog`)**:
  - Registro clasificado de pérdidas por `EXPIRATION` (caducidad), `KITCHEN_ERROR` (error cocina), `PREPARATION_WASTE` (porcionado), `DAMAGE_SPILL` (accidentes) y `OTHER`.
  - Cuantificación financiera inmediata de la pérdida en pesos/dinero real y registro inmutable en auditoría forense (`WASTE_RECORDED`, `WARNING`).
* **Múltiples Bodegas y Traspasos Internos (`Warehouse`, `WarehouseStock`, `WarehouseTransfer`)**:
  - Centros de almacenamiento independientes (`Almacén General`, `Cocina Caliente`, `Barra de Bebidas`).
  - Bitácora de traspaso de mercancía entre bodegas con validación de existencias origen y firma de responsable.
* **Centro de Gestión de Inventarios (`/inventory`)**:
  - Pestañas profesionales tipo ERP: Insumos & Stock (con filtro RAW vs PREPARED), Sub-recetas & Producción, Control de Mermas con métricas financieras, Bodegas & Traspasos, Compras y Fichas de Platillos.

### 6.18. Facturación Fiscal Mexicana (CFDI 4.0 Directo & Portal Público de Auto-Facturación)
* **Motor CFDI 4.0 Nativo (`src/lib/cfdi.ts`)**:
  - Implementación compliant con el **Anexo 20 del SAT** (versión 4.0). Genera el árbol XML canónico con `<cfdi:Comprobante>`, `<cfdi:Emisor>`, `<cfdi:Receptor>`, `<cfdi:Conceptos>`, `<cfdi:Impuestos>`, sellos digitales criptográficos SHA256withRSA, y el nodo de timbre `<tfd:TimbreFiscalDigital>` versión 1.1 con UUID SAT.
  - Catálogos oficiales del SAT integrados: Regímenes Fiscales (`601`, `612`, `626`, etc.), Usos de CFDI (`G01`, `G03`, `S01`, `CP01`, etc.), Formas de Pago (`01`, `03`, `04`, `28`, etc.) y Métodos (`PUE`, `PPD`).
  - Validación de RFC para Personas Físicas (13 caracteres), Personas Morales (12 caracteres), y genéricos del SAT (`XAXX010101000`, `XEXX010101000`).
  - Generación de la URL oficial de verificación SAT con código QR (`https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?...`).
* **Modelo de Datos `Invoice`**:
  - Relación 1-a-1 con `Order` (`order.invoiceId` con `@unique` para prevención de doble facturación).
  - Almacena UUID fiscal, serie, folio consecutivo por marca, datos fiscales completos del receptor, desglose de subtotal/IVA/total, XML timbrado inmutable, y sellos digitales.
* **Portal de Auto-Facturación para Comensales (`/facturacion`)**:
  - Portal web público responsivo (móvil y escritorio) para clientes de restaurantes y dark kitchens.
  - Búsqueda por número de ticket (`#DF-...`) y fecha/importe para consultar comanda.
  - Formulario de captura fiscal guiada con validación de RFC en tiempo real, selección de régimen y uso de CFDI.
  - Emisión y timbrado en 1 clic con descarga inmediata de archivos oficiales: XML y PDF.
* **Tickets Térmicos con Datos de Facturación (`ThermalTicketModal`)**:
  - Impresión automática en el pie de los tickets de venta con el número de orden y la URL del portal de autofacturación para que el cliente facture desde su teléfono.
* **Representación Impresa PDF con Datos SAT (`InvoicePdfModal`)**:
  - Incluye UUID timbrado, régimen fiscal del emisor y receptor, sellos digitales, cadena original del SAT y código QR de verificación fiscal.
* **Configuración por Marca (`/integrations` - Tab Facturación CFDI 4.0)**:
  - Formulario administrativo para configurar RFC, Razón Social, Régimen Fiscal, Código Postal, Serie, Folio Consecutivo y selector de ambiente (Sandbox vs Producción).

### 6.19. KDS Avanzado (Semáforos SLA por Platillo, Tiempos de Servicio y Ruteo por Estaciones)
* **Semáforos SLA Inteligentes en Tiempo Real**:
  - Tiempo objetivo diferenciado por platillo (`targetPrepTime`) y consolidado por comanda (`prepTimeTarget`).
  - Barra de progreso y cronómetro en vivo con código de semáforo:
    - 🟢 **En Tiempo** (< 70% del SLA).
    - 🟡 **Alerta SLA** (70% - 100% del SLA).
    - 🔴 **Vencido / Fuera de SLA** (> 100% del SLA) con cálculo dinámico del tiempo de demora (+MM:SS retraso) y borde pulsante de advertencia.
* **Comanda por Tiempos de Servicio ("Marcha de Comanda")**:
  - Agrupación visual de platillos en 3 bloques operativos: `1er Tiempo (Entradas & Bebidas)`, `2do Tiempo (Platos Fuertes)` y `3er Tiempo (Postres)`.
  - Botón interactivo **"Marchar Siguiente Tiempo"** en cocina y salón para activar el siguiente bloque de cocción con timbre auditivo SSE en tiempo real.
* **Control Interactivo por Platillo Individual (`itemUpdates`)**:
  - Ciclo de estados independiente por platillo (`PENDING` ➔ `COOKING` ➔ `DONE`) con timestamps `startedAt` y `finishedAt`.
  - Transición automática: al marcar todos los platillos como `DONE`, la orden avanza automáticamente a `READY` y detona la campana de despacho.
* **Ruteo de Pantalla por Estaciones de Trabajo (`kitchenStation`)**:
  - Filtro táctil en cabecera: `Todas`, `Cocina Caliente`, `Parrilla / Plancha`, `Barra de Bebidas`, `Postres / Panadería` y `Barra Fría / Ensaladas`.
  - Conteo en vivo de platillos pendientes por estación.
* **Métricas KDS en Vivo**:
  - Indicador de % de Cumplimiento de SLA del turno y cronómetro de preparación.

---

## 7. Estructura de Directorios

```text
darkflow/
├── prisma/
│   ├── schema.prisma         # Esquema activo de Prisma (generado/conmutable)
│   ├── schema.postgresql.prisma # Esquema para PostgreSQL / Supabase / Neon
│   ├── schema.sqlite.prisma  # Esquema plantilla para SQLite local
│   ├── seed.ts               # Semillero inicial de marcas, usuarios y menú
│   └── dev.db                # Base de datos SQLite local
├── public/                   # Activos públicos y logotipos
├── scripts/
│   └── switch-db.js          # Utilidad para conmutar entre PostgreSQL y SQLite
├── src/
│   ├── app/
│   │   ├── api/              # Route Handlers (Backend REST)
│   │   │   ├── audit/        # Consulta y filtros de logs de auditoría forense
│   │   │   ├── auth/         # Login, logout, me
│   │   │   ├── brands/       # Consulta y creación de marcas
│   │   │   ├── cash/         # Sesiones y cortes de caja
│   │   │   ├── categories/   # Secciones de menú
│   │   │   ├── combos/       # Paquetes y combos comerciales
│   │   │   ├── coupons/      # Cupones de descuento y validación
│   │   │   ├── customers/    # CRM de clientes y puntos de fidelidad
│   │   │   ├── dashboard/    # KPIs y datos de gráficas
│   │   │   ├── delivery-simulator/ # Simulador y webhooks de Uber Eats, Rappi, DiDi Food
│   │   │   ├── drivers/      # Perfiles y estados de repartidores
│   │   │   ├── health/       # Healthcheck activo de DB y uptime (/api/health)
│   │   │   ├── integrations/ # Webhooks y configuración de pasarelas, delivery y fiscal
│   │   │   │   ├── delivery/ # Métricas y resumen financiero de delivery
│   │   │   │   ├── invoicing/# Configuración fiscal CFDI 4.0 por marca
│   │   │   │   └── payments/ # Credenciales y configuración de Stripe & Mercado Pago
│   │   │   ├── inventory/    # Insumos, compras, sub-recetas, mermas y bodegas
│   │   │   ├── invoices/     # Emisión, consulta y descarga de CFDI 4.0 (XML/JSON)
│   │   │   ├── orders/       # Listado, creación, ciclo de vida y stream SSE de pedidos
│   │   │   ├── payments/     # Creación de sesiones de pago y confirmación sandbox
│   │   │   │   ├── confirm-sandbox/ # Aprobación 1-clic de órdenes sandbox
│   │   │   │   └── create-session/  # Generación de Stripe Checkout o MP Preference
│   │   │   ├── products/     # Catálogo de platillos por marca
│   │   │   ├── public/       # APIs públicas para clientes (menú, órdenes, autofacturación)
│   │   │   │   └── invoicing/# Lookup y timbrado de facturas para comensales
│   │   │   ├── reports/      # Agregados para reportes financieros y de inventario
│   │   │   ├── tables/       # Mesas físicas, estados y comensales
│   │   │   ├── users/        # Gestión de personal, credenciales y RBAC
│   │   │   └── webhooks/     # Receptores de webhooks externos
│   │   │       ├── delivery/ # Pedidos entrantes de Uber Eats, Rappi y DiDi Food
│   │   │       └── payments/ # Eventos de pago unificados de Stripe y Mercado Pago
│   │   ├── audit/page.tsx    # Vista de Auditoría & Trazabilidad Forense de Seguridad
│   │   ├── cash/page.tsx     # Vista de Corte de Caja
│   │   ├── customers/page.tsx# Vista CRM de Clientes & Puntos de Fidelidad
│   │   ├── delivery-simulator/page.tsx # Simulador de Delivery Apps
│   │   ├── drivers/page.tsx  # Vista de Despacho y Choferes (En Vivo SSE)
│   │   ├── facturacion/page.tsx # Portal Público de Auto-Facturación CFDI 4.0 para Comensales
│   │   ├── integrations/page.tsx # Hub de Integraciones (Delivery Apps, Pasarelas y CFDI 4.0)
│   │   ├── inventory/page.tsx# Vista de Almacén, Compras y Fichas Técnicas
│   │   ├── kitchen/page.tsx  # Vista KDS de Cocina en Tiempo Real (SSE + Campana)
│   │   ├── login/page.tsx    # Vista de Login con accesos demo
│   │   ├── m/[slug]/page.tsx # Menú Digital y Auto-Pedido Móvil para Comensales
│   │   ├── menu/page.tsx     # Vista de Catálogo y Menú Digital (Administrador)
│   │   ├── order-tracking/[id]/page.tsx # Rastreo en vivo del estado de la comanda
│   │   ├── page.tsx          # Vista de Dashboard Principal
│   │   ├── pos/page.tsx      # Vista de Punto de Venta con CRM, Tickets y Facturas
│   │   ├── promotions/page.tsx# Vista de Gestión de Cupones y Combos
│   │   ├── reports/page.tsx  # Vista de Reportes con Facturación PDF y Exportación Excel/CSV
│   │   ├── tables/page.tsx   # Vista de Salón y Mesas con QR y Pre-cuenta Térmica
│   │   ├── users/page.tsx    # Vista de Administración de Personal & Roles
│   │   ├── globals.css       # Estilos globales y tokens de Tailwind v4
│   │   └── layout.tsx        # Layout raíz con BrandThemeProvider
│   ├── components/
│   │   ├── BrandThemeProvider.tsx # Inyector de variables CSS de marca
│   │   ├── DashboardContainer.tsx # Layout con Sidebar, Topbar y Selector
│   │   ├── InvoicePdfModal.tsx    # Modal universal de Factura Fiscal / Nota de Venta PDF (Carta/A4)
│   │   └── ThermalTicketModal.tsx # Generador universal de tickets térmicos ESC/POS
│   ├── lib/
│   │   ├── audit.ts          # Helper resiliente para registro de auditoría y captura de IP
│   │   ├── auth.ts           # Cifrado/Descifrado de sesión AES-256-GCM
│   │   ├── cfdi.ts           # Motor Anexo 20 SAT CFDI 4.0, sellado criptográfico y QR
│   │   ├── db.ts             # Instancia singleton de Prisma Client
│   │   ├── escpos.ts         # Driver ESC/POS puro sobre sockets TCP 9100 y formateador binario
│   │   ├── events.ts         # Singleton de EventEmitter para eventos reactivos
│   │   ├── hash.ts           # Hash y verificación PBKDF2 de contraseñas
│   │   ├── payments.ts       # Integración REST Stripe, Mercado Pago, Sandbox y confirmación atómica
│   │   ├── sound.ts          # Sintetizador Web Audio API de campanas KDS
│   │   └── store.ts          # Estado global Zustand (Carrito, Brand, Toasts)
│   └── middleware.ts         # Protección perimetral de rutas privadas y acceso a rutas públicas
├── .dockerignore             # Exclusiones de contexto para imagen Docker
├── .env.example              # Plantilla documentada de variables de entorno
├── Dockerfile                # Imagen multi-etapa (<180MB) optimizada para producción
├── docker-compose.yml        # Stack completo con PostgreSQL 16 y App
├── docker-entrypoint.sh      # Script de inicialización y auto-migración
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
5. **Evolución sin Romper:** No reescribir módulos funcionales existentes; extender mediante componentes o factores adicionales documentados.
6. **Inmutabilidad en Auditoría:** Los registros de `AuditLog` nunca deben ser modificados o eliminados; su inserción es resiliente y no bloqueante.

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
* ✅ **Fase 9 (Completada):** Webhooks y Simulador de Delivery Apps (Uber Eats, Rappi, DiDi Food con comisiones y payout neto).
* ✅ **Fase 10 (Completada):** Exportaciones Avanzadas en PDF (Comprobante de Venta y Factura Comercial CFDI con motor de impresión Carta/A4).
* ✅ **Fase 11 (Completada):** Migración a PostgreSQL en producción (Supabase / Neon / Cloud SQL) y Contenerización con Docker.
* ✅ **Fase 12 (Completada):** Menú Digital QR y Auto-Pedido Móvil para Comensales con Rastreo en Vivo.
* ✅ **Fase 13 (Completada):** Auditoría Inmutable, Historial de Seguridad y Registro de Actividad (`/audit`, severidades `INFO`/`WARNING`/`CRITICAL`, exportación CSV e inspección forense).
* ✅ **Fase 14 (Completada):** Pasarelas de Pago Digitales Integradas (Stripe y Mercado Pago con modo Sandbox, pagos móviles en /m/[slug], QR dinámico en POS, Webhooks unificados y conciliación SSE).
* ✅ **Fase 15 (Completada):** Operativa de Salón Avanzada (Cuentas Divididas por partes iguales o platillos, Reubicación y Fusión atómica de mesas en `/tables`, y Control/Reparto equitativo de propinas en `/pos` y `/cash`).
* ✅ **Fase 16 (Completada):** Modificadores Avanzados, Grupos de Extras y Términos de Cocina (Términos de carne, toppings adicionales, descuentos automáticos de inventario, modal táctil en POS y QR, badges en KDS y desglose en tickets térmicos).
* ✅ **Fase 17 (Completada):** Almacén y Costeo Avanzado (Sub-recetas multinivel, órdenes de producción en cocina, bitácora clasificada de mermas con impacto financiero y traspasos internos entre bodegas).
* ✅ **Fase 18 (Completada):** Facturación Fiscal Mexicana CFDI 4.0 (Motor Anexo 20 SAT, generación de XML con sellos SHA256 y Timbre Fiscal Digital, API `/api/invoices`, Portal Público `/facturacion` para comensales, avisos en tickets térmicos y tab en `/integrations`).
* ✅ **Fase 19 (Completada):** KDS Avanzado (Semáforos SLA en tiempo real por comanda y platillo, comanda por tiempos de servicio con marcha interactiva, marcado de platillos por ítem y ruteo por estaciones de cocina).
### 6.20. Reservaciones de Mesa, Lista de Espera & Estación de Hostess (`/tables`)
* **Modelo de Datos Relacional (`Reservation` y `WaitlistEntry`)**:
  - `Reservation`: Agendado de citas con `customerName`, `customerPhone`, `customerEmail`, `diners`, `reservationDate`, `durationMinutes`, `status` (`PENDING`, `CONFIRMED`, `SEATED`, `CANCELLED`, `NO_SHOW`), `tableId`, `zonePreference` y `notes`.
  - `WaitlistEntry`: Turnos en puerta con `customerName`, `customerPhone`, `diners`, `estimatedWaitMinutes`, `status` (`WAITING`, `NOTIFIED`, `SEATED`, `CANCELLED`), `zonePreference`, `tableId`, `notifiedAt`, `seatedAt` y `notes`.
  - Paridad de esquemas simultánea en SQLite local y PostgreSQL para producción.
* **APIs REST y Asignación Atómica de Mesas**:
  - `/api/reservations` (GET con filtros por fecha, teléfono y estado; POST con validación de traslapes y cupo).
  - `/api/reservations/[id]` (PUT para confirmar, cancelar o sentar comensal). Al sentar a la reserva, se ejecuta una transacción que actualiza `Table.status = 'OCCUPIED'`.
  - `/api/waitlist` (GET de lista activa en puerta `WAITING`/`NOTIFIED`, POST para dar de alta turnos).
  - `/api/waitlist/[id]` (PUT para avisar que la mesa está lista con timestamp `notifiedAt` o sentar al comensal en mesa disponible cambiando su estado a `OCCUPIED`).
  - `/api/tables`: Integración en el GET de mesas para adjuntar las reservaciones del día en curso.
* **Estación de Hostess & Recepción (`/tables`)**:
  - Selector de modo dual: **Salón & Mapa de Mesas** vs **Hostess & Puerta**.
  - **Indicadores en Tiempo Real**: Tarjetas KPI de Mesas Libres, En Lista de Espera, Reservaciones Hoy y Tiempo Promedio de Espera.
  - **Badges de Reservación en Mesas**: Las tarjetas del salón muestran alertas púrpuras `📅 Reserva: [HH:mm]` con el nombre del cliente y número de personas.
  - **Tablero Split View**:
    - Columna izquierda: **Lista de Espera en Puerta** con turnos cronológicos (#1, #2...), cronómetro de minutos transcurridos con semáforo de demora, avisos de mesa lista ("🔔 Avisar") y acción rápida "🪑 Sentar".
    - Columna derecha: **Agenda de Reservaciones** con calendario selector de fecha, buscador por teléfono/nombre, estatus de confirmación y asignación de mesa.
  - **Modales Táctiles**: Alta de reservaciones, registro de lista de espera con preferencias de zona y diálogo inteligente de asignación de mesas por capacidad recomendada.

---

## 7. Estructura de Directorios

```text
darkflow/
├── prisma/
│   ├── schema.prisma         # Esquema activo de Prisma (generado/conmutable)
│   ├── schema.postgresql.prisma # Esquema para PostgreSQL / Supabase / Neon
│   ├── schema.sqlite.prisma  # Esquema plantilla para SQLite local
│   ├── seed.ts               # Semillero inicial de marcas, usuarios y menú
│   └── dev.db                # Base de datos SQLite local
├── public/                   # Activos públicos y logotipos
├── scripts/
│   └── switch-db.js          # Utilidad para conmutar entre PostgreSQL y SQLite
├── src/
│   ├── app/
│   │   ├── api/              # Route Handlers (Backend REST)
│   │   │   ├── attendance/   # Reloj checador de personal y turnos de asistencia
│   │   │   ├── audit/        # Consulta y filtros de logs de auditoría forense
│   │   │   ├── auth/         # Login, logout, me
│   │   │   ├── brands/       # Consulta y creación de marcas
│   │   │   ├── cash/         # Sesiones y cortes de caja
│   │   │   ├── categories/   # Secciones de menú
│   │   │   ├── combos/       # Paquetes y combos comerciales
│   │   │   ├── coupons/      # Cupones de descuento y validación
│   │   │   ├── customers/    # CRM de clientes y puntos de fidelidad
│   │   │   ├── dashboard/    # KPIs y datos de gráficas
│   │   │   ├── delivery-simulator/ # Simulador y webhooks de Uber Eats, Rappi, DiDi Food
│   │   │   ├── drivers/      # Perfiles y estados de repartidores
│   │   │   ├── health/       # Healthcheck activo de DB y uptime (/api/health)
│   │   │   ├── integrations/ # Webhooks y configuración de pasarelas, delivery y fiscal
│   │   │   ├── inventory/    # Insumos, compras, sub-recetas, mermas y bodegas
│   │   │   ├── invoices/     # Emisión, consulta y descarga de CFDI 4.0 (XML/JSON)
│   │   │   ├── orders/       # Listado, creación, ciclo de vida y stream SSE de pedidos
│   │   │   ├── payments/     # Creación de sesiones de pago y confirmación sandbox
│   │   │   ├── printers/     # Hardware bridge ESC/POS LAN/IP y configuración de comanderas
│   │   │   ├── products/     # Catálogo de platillos por marca
│   │   │   ├── public/       # APIs públicas para clientes (menú, órdenes, autofacturación)
│   │   │   ├── reports/      # Agregados para reportes financieros y de inventario
│   │   │   ├── reservations/ # Reservaciones de mesa y agenda de visitas
│   │   │   ├── tables/       # Mesas físicas, estados, comensales y reubicación
│   │   │   ├── users/        # Gestión de personal, credenciales, PIN y RBAC
│   │   │   ├── waitlist/     # Lista de espera en puerta y turnos
│   │   │   └── webhooks/     # Receptores de webhooks externos
│   │   ├── audit/page.tsx    # Vista de Auditoría & Trazabilidad Forense de Seguridad
│   │   ├── cash/page.tsx     # Vista de Corte de Caja
│   │   ├── customers/page.tsx# Vista CRM de Clientes & Puntos de Fidelidad
│   │   ├── delivery-simulator/page.tsx # Simulador de Delivery Apps
│   │   ├── drivers/page.tsx  # Vista de Despacho y Choferes (En Vivo SSE)
│   │   ├── facturacion/page.tsx # Portal Público de Auto-Facturación CFDI 4.0 para Comensales
│   │   ├── integrations/page.tsx # Hub de Integraciones (Delivery Apps, Pasarelas, CFDI 4.0 e Impresoras)
│   │   ├── inventory/page.tsx# Vista de Almacén, Compras y Fichas Técnicas
│   │   ├── kitchen/page.tsx  # Vista KDS de Cocina en Tiempo Real (SSE + Campana)
│   │   ├── login/page.tsx    # Vista de Login con accesos demo
│   │   ├── m/[slug]/page.tsx # Menú Digital y Auto-Pedido Móvil para Comensales
│   │   ├── menu/page.tsx     # Vista de Catálogo y Menú Digital (Administrador)
│   │   ├── order-tracking/[id]/page.tsx # Rastreo en vivo del estado de la comanda
│   │   ├── page.tsx          # Vista de Dashboard Principal
│   │   ├── pos/page.tsx      # Vista de Punto de Venta con CRM, Tickets y Facturas
│   │   ├── promotions/page.tsx# Vista de Gestión de Cupones y Combos
│   │   ├── reports/page.tsx  # Vista de Reportes con Facturación PDF y Exportación Excel/CSV
│   │   ├── tables/page.tsx   # Vista de Salón, Mesas, Hostess y Lista de Espera
│   │   ├── users/page.tsx    # Vista de Personal, PINs y Control de Asistencia / Nómina
│   │   ├── globals.css       # Estilos globales y tokens de Tailwind v4
│   │   └── layout.tsx        # Layout raíz con BrandThemeProvider
│   ├── components/
│   │   ├── BrandThemeProvider.tsx # Inyector de variables CSS de marca
│   │   ├── DashboardContainer.tsx # Layout con Sidebar, Topbar y Selector
│   │   ├── InvoicePdfModal.tsx    # Modal universal de Factura Fiscal / Nota de Venta PDF (Carta/A4)
│   │   ├── QuickClockModal.tsx    # Reloj Checador flotante con teclado PIN numérico
│   │   └── ThermalTicketModal.tsx # Generador universal de tickets térmicos ESC/POS
│   ├── lib/
│   │   ├── audit.ts          # Helper resiliente para registro de auditoría y captura de IP
│   │   ├── auth.ts           # Cifrado/Descifrado de sesión AES-256-GCM
│   │   ├── cfdi.ts           # Motor Anexo 20 SAT CFDI 4.0, sellado criptográfico y QR
│   │   ├── db.ts             # Instancia singleton de Prisma Client
│   │   ├── escpos.ts         # Driver ESC/POS puro sobre sockets TCP 9100 y formateador binario
│   │   ├── events.ts         # Singleton de EventEmitter para eventos reactivos
│   │   ├── hash.ts           # Hash y verificación PBKDF2 de contraseñas
│   │   ├── payments.ts       # Integración REST Stripe, Mercado Pago, Sandbox y confirmación atómica
│   │   ├── sound.ts          # Sintetizador Web Audio API de campanas KDS
│   │   └── store.ts          # Estado global Zustand (Carrito, Brand, Toasts)
│   └── middleware.ts         # Protección perimetral de rutas privadas y acceso a rutas públicas
├── .dockerignore             # Exclusiones de contexto para imagen Docker
├── .env.example              # Plantilla documentada de variables de entorno
├── Dockerfile                # Imagen multi-etapa (<180MB) optimizada para producción
├── docker-compose.yml        # Stack completo con PostgreSQL 16 y App
├── docker-entrypoint.sh      # Script de inicialización y auto-migración
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
5. **Evolución sin Romper:** No reescribir módulos funcionales existentes; extender mediante componentes o factores adicionales documentados.
6. **Inmutabilidad en Auditoría:** Los registros de `AuditLog` nunca deben ser modificados o eliminados; su inserción es resiliente y no bloqueante.

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
* ✅ **Fase 9 (Completada):** Webhooks y Simulador de Delivery Apps (Uber Eats, Rappi, DiDi Food con comisiones y payout neto).
* ✅ **Fase 10 (Completada):** Exportaciones Avanzadas en PDF (Comprobante de Venta y Factura Comercial CFDI con motor de impresión Carta/A4).
* ✅ **Fase 11 (Completada):** Migración a PostgreSQL en producción (Supabase / Neon / Cloud SQL) y Contenerización con Docker.
* ✅ **Fase 12 (Completada):** Menú Digital QR y Auto-Pedido Móvil para Comensales con Rastreo en Vivo.
* ✅ **Fase 13 (Completada):** Auditoría Inmutable, Historial de Seguridad y Registro de Actividad (`/audit`, severidades `INFO`/`WARNING`/`CRITICAL`, exportación CSV e inspección forense).
* ✅ **Fase 14 (Completada):** Pasarelas de Pago Digitales Integradas (Stripe y Mercado Pago con modo Sandbox, pagos móviles en /m/[slug], QR dinámico en POS, Webhooks unificados y conciliación SSE).
* ✅ **Fase 15 (Completada):** Operativa de Salón Avanzada (Cuentas Divididas por partes iguales o platillos, Reubicación y Fusión atómica de mesas en `/tables`, y Control/Reparto equitativo de propinas en `/pos` y `/cash`).
* ✅ **Fase 16 (Completada):** Modificadores Avanzados, Grupos de Extras y Términos de Cocina (Términos de carne, toppings adicionales, descuentos automáticos de inventario, modal táctil en POS y QR, badges en KDS y desglose en tickets térmicos).
* ✅ **Fase 17 (Completada):** Almacén y Costeo Avanzado (Sub-recetas multinivel, órdenes de producción en cocina, bitácora clasificada de mermas con impacto financiero y traspasos internos entre bodegas).
* ✅ **Fase 18 (Completada):** Facturación Fiscal Mexicana CFDI 4.0 (Motor Anexo 20 SAT, generación de XML con sellos SHA256 y Timbre Fiscal Digital, API `/api/invoices`, Portal Público `/facturacion` para comensales, avisos en tickets térmicos y tab en `/integrations`).
* ✅ **Fase 19 (Completada):** KDS Avanzado (Semáforos SLA en tiempo real por comanda y platillo, comanda por tiempos de servicio con marcha interactiva, marcado de platillos por ítem y ruteo por estaciones de cocina).
* ✅ **Fase 20 (Completada):** Hardware Bridge Local & Impresión Silenciosa Desatendida (Driver ESC/POS nativo sobre TCP socket en puerto 9100 sin binarios externos, comanderas de red por estación, apertura remota de cajón de dinero, auto-impresión en segundo plano y panel en `/integrations`).
* ✅ **Fase 21 (Completada):** Control de Asistencia, Turnos de Personal & Reloj Checador (Modal flotante universal QuickClock con teclado numérico y autenticación PIN de 4 dígitos, modelo `AttendanceRecord`, APIs `/api/attendance/*`, cálculo automático de horas trabajadas descontando descansos, tablero en `/users` y exportación a CSV de nómina).
* ✅ **Fase 22 (Completada):** Reservaciones de Mesa, Lista de Espera & Estación de Hostess (Recepción de comensales, gestión de turnos de espera con tiempos estimados, asignación inteligente de mesas por capacidad, alertas visuales en `/tables`, y APIs `/api/reservations` y `/api/waitlist`).
* ✅ **Fase 23 (Completada):** Tarifas Dinámicas, Happy Hour & Promociones por Horario (Reglas de precios programados por día de la semana y ventanas de horario, soporte para 2x1, 3x2, precios fijos y descuentos porcentuales automáticos evaluados en tiempo real en POS y Menú Digital QR de comensales `/m/[slug]`, badges llameantes `🔥 ACTIVO AHORA`, cálculo dinámico de ahorro y panel de administración en `/promotions`).
* ✅ **Fase 24 (Completada):** Monedero Electrónico, Saldo Prepago & Tarjetas de Regalo (Modelos `GiftCard` y `GiftCardTransaction` con paridad dual SQLite/PostgreSQL, emisión de tarjetas digitales/físicas/VIP con PIN de seguridad y vigencia, recargas con registro de método de pago, débitos atómicos directos en transacciones Prisma contra pedidos de POS y auto-pedido móvil `/m/[slug]`, auditoría/kardex transaccional con balance antes/después, y módulo visual integrado en `/customers` con KPIs y diseño de tarjeta VIP metálica).
* ✅ **Fase 25 (Completada):** Cortes de Caja Ciego, Arqueo Parcial "Corte X", Cierre Oficial "Corte Z" & Reporte Z Fiscal (Modelos `CashMovement` y `CashCut` vinculados al turno `CashSession`; conteo de efectivo a ciegas con desglose por denominaciones de billetes $1000-$20, monedas $10-$0.50 y vouchers; flujo de movimientos con entradas de cambio y sangrías/retiros de seguridad con motivo y supervisor; Corte X parcial a mitad de turno sin cierre de sesión; Corte Z definitivo con folio fiscal consecutivo `Z-XXXX`, sellado inmutable del balance esperado vs contado, bitácora de auditoría crítica ante descuadres y panel ejecutivo en `/cash` con visualización/impresión térmica ESC/POS 80mm tanto en navegador como comanderas de red TCP 9100).
* ✅ **Fase 26 (Completada):** Auditoría de Costos & Receta Teórica vs Consumo Real (Modelos `InventoryAudit` y `InventoryAuditItem` con paridad dual SQLite/PostgreSQL; motor analítico en `src/lib/costAudit.ts` calculando explosión de materias primas por recetas y sub-recetas vendidas; comparativa contra stock real y compras; cálculo automático de Precio Promedio Ponderado - PPP vs Costo Estándar; análisis global de % Food Cost con semáforos de salud financiera; Matriz BCG Gastronómica / Ingeniería de Menú clasificando platillos en Estrellas 🌟, Caballos 🐎, Rompecabezas 🧩 y Perros 🐶 con recomendaciones operativas; módulo de arqueo físico ciego antifraude y aplicación atómica de ajustes a existencias con registro automático de mermas; integrado en tab 7 de `/inventory`).
* ✅ **Fase 28 (Completada):** Niveles de Lealtad VIP (Tier Status: Bronze, Silver, Gold, Platinum) & Descuentos Automatizados por Fidelidad (Campos `tier`, `birthDate`, `pointsMultiplier` y `tierDiscountPct` en `Customer` con paridad dual SQLite/PostgreSQL; motor en `src/lib/loyaltyTiers.ts` con umbrales por consumo LTV acumulado o número de pedidos; multiplicadores acelerados de 1.0x hasta 2.0x puntos y descuentos VIP automáticos del 5% al 15%; detección de Club de Cumpleaños con alertas de semana y mes; promociones automáticas de nivel al cerrar comandas en POS y pedidos online; filtros por nivel y modal de beneficios en `/customers`).
* ⏳ **Fase 29 (Siguiente):** Encuestas de Satisfacción, Calificación NPS (Net Promoter Score) & Reseñas de Servicio en Menú Digital QR con Alertas Inmediatas de Recuperación de Clientes.

