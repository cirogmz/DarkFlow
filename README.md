# DarkFlow Manager | Multi-Brand Dark Kitchen MVP

**DarkFlow Manager** es un sistema full-stack de administración integral para cocinas fantasma (Dark Kitchens) diseñado para centralizar operaciones de múltiples marcas en un solo flujo eficiente.

## 🚀 Características del MVP

1. **Autenticación y Aislamiento Multi-Marca**: Login único con asignación de roles. Los datos de pedidos, inventarios y caja están aislados por marca, permitiendo a los administradores cambiar de cocina activa con un switch dinámico que adapta el color de acento de la interfaz instantáneamente.
2. **Punto de Venta (POS) Delivery**: Selección digital de platillos con verificación en tiempo real de insumos (alerta si faltan ingredientes para una receta). Cálculo automático de comisiones de reparto, IVA (16%), propinas y ticketera térmica simulada (`window.print()`).
3. **Control de Inventarios**: Descuento automático de stock de insumos por receta al marcar el pedido como **Entregado**. Alertas visuales de stock bajo y registrador de compras de mercancía.
4. **Kitchen Display System (KDS)**: Pantalla de cocina auto-actualizable para avanzar pedidos desde `Recibido` ➔ `Preparando` ➔ `Listo`. Alertas de retraso de preparación (más de 15 min).
5. **Corte de Caja (Arqueo)**: Apertura y cierre de turnos por cajero, acumulando ventas en efectivo, tarjetas y apps externas. Detección automática de discrepancias de caja.
6. **Logística de Repartidores**: Asignación de comandas listas a choferes disponibles y monitoreo del estado de las rutas de entrega.

---

## 🛠️ Tech Stack & Arquitectura

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Lucide React + Recharts.
- **Backend**: Next.js API Routes (App Router Route Handlers).
- **Base de Datos**: PostgreSQL / SQLite con **Prisma ORM**.
- **Seguridad / Sesión**: Autenticación HTTP-Only basada en cookies y cifrado simétrico AES-256-GCM nativo de Node.js (cero dependencias externas para evitar problemas de instalación).
- **Estado**: Zustand (Estado global de POS, temas y notificaciones).

---

## 💻 Instrucciones de Instalación Local

Debido a que los directorios sincronizados en la nube (como Google Drive) imponen bloqueos de archivos que rompen el instalador de paquetes de `npm`, se recomienda correr el servidor localmente en una carpeta fuera de sincronización (ej. tu disco `C:\`).

### Paso 1: Copiar el proyecto a un directorio local
Crea una carpeta local y copia los archivos de código fuente:
```bash
# Ejemplo de copiado en Windows PowerShell/CMD
mkdir C:\Users\tu-usuario\darkflow-manager
robocopy "G:\Mi unidad\Antigravity\Dark" C:\Users\tu-usuario\darkflow-manager /E /XD node_modules .next
cd C:\Users\tu-usuario\darkflow-manager
```

### Paso 2: Instalar Dependencias
Instala los paquetes en tu directorio local:
```bash
npm install --no-audit --no-fund
```

### Paso 3: Inicializar la Base de Datos (SQLite por defecto)
Ejecuta las migraciones de Prisma y rellena la base de datos con los datos de prueba (seed):
```bash
npx prisma migrate dev --name init
npx prisma db seed
```
*Esto creará la base de datos `prisma/dev.db` y sembrará 3 marcas independientes (Burger Peak, Taco Express, Sushi Wave) con 15 platos, insumos e ingredientes cada una.*

### Paso 4: Iniciar Servidor de Desarrollo
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3050) en tu navegador para ver la aplicación funcionando.

---

## 🔑 Credenciales Demo del MVP
Puedes iniciar sesión usando cualquiera de las siguientes cuentas de prueba:

- **Super Admin**: `admin@darkflow.com` | Contraseña: `admin123` (Acceso a las 3 marcas, reportes cruzados).
- **Gerente de Marca**: `manager@darkflow.com` | Contraseña: `manager123` (Acceso a Burger Peak y Taco Express).
- **Cocinero**: `cocina@darkflow.com` | Contraseña: `cocina123` (KDS de Burger Peak).
- **Cajero / POS**: `cajero@darkflow.com` | Contraseña: `cajero123` (Acceso a las 3 marcas para cobros).

---

## 🗄️ Cómo cambiar a PostgreSQL (Supabase / Neon)
Para migrar el proyecto de SQLite a PostgreSQL en producción, solo debes seguir estos pasos:

1. Abre [prisma/schema.prisma](file:///prisma/schema.prisma) y cambia el datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Agrega tu cadena de conexión en el archivo `.env` en el directorio raíz:
   ```env
   DATABASE_URL="postgresql://usuario:contraseña@servidor.supabase.co:5432/postgres?schema=public"
   ```
3. Regenera el cliente de Prisma y sube el esquema:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

---

## 🎯 Roadmap de Escalabilidad (Fase 2)
### De 3 a 5 Marcas
Para expandir el sistema a 5 marcas:

1. Agrega los registros correspondientes en el script `prisma/seed.ts` e inicializa sus colores corporativos e insumos.
2. La arquitectura multi-tenant basada en `brandId` resolverá de forma natural la visualización y segregación de los menús e inventarios sin requerir cambios de código.

### Hacia Restaurantes Físicos Completos (Comensales en Sala)
Para convertir DarkFlow en un sistema híbrido (Dark Kitchen + Restaurante Físico):

1. **Mesa Física**: Añadir una tabla `Table` (`id`, `number`, `status`, `capacity`, `brandId`).
2. **Asignación de Mesas**: Agregar campo `tableId` en la tabla `Order` (relación opcional, nula para pedidos delivery).
3. **Flujo de Comensales**:
   - Crear estados de pedido específicos para salón (ej. `ORDERED` ➔ `PREPARING` ➔ `READY` ➔ `SERVED`).
   - Crear un panel de asignación de meseros.
4. **Dashboard Híbrido**: Separar analíticas de ventas por canal: "Delivery" vs "Comensal en Sala" en los KPIs de facturación.
