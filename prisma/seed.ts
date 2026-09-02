import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('Starting seed database...');

  // Clean old data
  await prisma.userBrand.deleteMany({});
  await prisma.recipeItem.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cashSession.deleteMany({});
  await prisma.deliveryProfile.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.ingredient.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Database cleaned. Creating Brands...');

  // 1. Brands
  const b1 = await prisma.brand.create({
    data: {
      name: 'Burger Peak',
      slug: 'burger-peak',
      primaryColor: '#F59E0B', // Amber
      secondaryColor: '#1E293B',
      logoUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=128&h=128&fit=crop&q=80',
    },
  });

  const b2 = await prisma.brand.create({
    data: {
      name: 'Taco Express',
      slug: 'taco-express',
      primaryColor: '#10B981', // Emerald
      secondaryColor: '#1E293B',
      logoUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=128&h=128&fit=crop&q=80',
    },
  });

  const b3 = await prisma.brand.create({
    data: {
      name: 'Sushi Wave',
      slug: 'sushi-wave',
      primaryColor: '#EF4444', // Red
      secondaryColor: '#1E293B',
      logoUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=128&h=128&fit=crop&q=80',
    },
  });

  console.log('Brands created. Creating Users...');

  // 2. Users & Roles
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@darkflow.com',
      name: 'Carlos SuperAdmin',
      passwordHash: hashPassword('admin123'),
      role: 'SUPER_ADMIN',
    },
  });

  const brandManager = await prisma.user.create({
    data: {
      email: 'manager@darkflow.com',
      name: 'Laura Gerente',
      passwordHash: hashPassword('manager123'),
      role: 'BRAND_ADMIN',
    },
  });

  const kitchenStaff = await prisma.user.create({
    data: {
      email: 'cocina@darkflow.com',
      name: 'Chef Ramón',
      passwordHash: hashPassword('cocina123'),
      role: 'KITCHEN',
    },
  });

  const cashier = await prisma.user.create({
    data: {
      email: 'cajero@darkflow.com',
      name: 'Ana Cajera',
      passwordHash: hashPassword('cajero123'),
      role: 'CASHIER',
    },
  });

  const driver1 = await prisma.user.create({
    data: {
      email: 'repartidor1@darkflow.com',
      name: 'Mario Motociclista',
      passwordHash: hashPassword('repartidor123'),
      role: 'DELIVERY',
    },
  });

  const driver2 = await prisma.user.create({
    data: {
      email: 'repartidor2@darkflow.com',
      name: 'Lucía Bici',
      passwordHash: hashPassword('repartidor123'),
      role: 'DELIVERY',
    },
  });

  // Assign brands to users
  // Super Admin gets access to all 3
  await prisma.userBrand.createMany({
    data: [
      { userId: superAdmin.id, brandId: b1.id },
      { userId: superAdmin.id, brandId: b2.id },
      { userId: superAdmin.id, brandId: b3.id },
      { userId: brandManager.id, brandId: b1.id },
      { userId: brandManager.id, brandId: b2.id },
      { userId: kitchenStaff.id, brandId: b1.id },
      { userId: cashier.id, brandId: b1.id },
      { userId: cashier.id, brandId: b2.id },
      { userId: cashier.id, brandId: b3.id },
    ],
  });

  // Create delivery profiles
  await prisma.deliveryProfile.create({
    data: { userId: driver1.id, vehicleType: 'MOTO', plateNumber: 'MEX-1234', status: 'AVAILABLE' },
  });
  await prisma.deliveryProfile.create({
    data: { userId: driver2.id, vehicleType: 'BICI', plateNumber: 'ECO-987', status: 'AVAILABLE' },
  });

  console.log('Users created. Seeding Brand 1: Burger Peak (Burgers)...');

  // 3. Burger Peak Categories
  const catB1 = await prisma.category.create({ data: { name: 'Hamburguesas', brandId: b1.id } });
  const catB2 = await prisma.category.create({ data: { name: 'Acompañamientos', brandId: b1.id } });
  const catB3 = await prisma.category.create({ data: { name: 'Bebidas', brandId: b1.id } });

  // Burger Peak Ingredients
  const ingMeat = await prisma.ingredient.create({ data: { name: 'Carne de Res 150g', stock: 150, unit: 'pzs', cost: 1.5, minStock: 20, brandId: b1.id } });
  const ingBun = await prisma.ingredient.create({ data: { name: 'Pan Brioche', stock: 200, unit: 'pzs', cost: 0.4, minStock: 25, brandId: b1.id } });
  const ingCheese = await prisma.ingredient.create({ data: { name: 'Queso Cheddar Rebanada', stock: 500, unit: 'pzs', cost: 0.15, minStock: 50, brandId: b1.id } });
  const ingBacon = await prisma.ingredient.create({ data: { name: 'Tocino Ahumado Tira', stock: 300, unit: 'pzs', cost: 0.25, minStock: 40, brandId: b1.id } });
  const ingPotato = await prisma.ingredient.create({ data: { name: 'Papas Cortadas', stock: 25.0, unit: 'kg', cost: 1.2, minStock: 5.0, brandId: b1.id } });
  const ingSoda = await prisma.ingredient.create({ data: { name: 'Refresco Cola Lata', stock: 120, unit: 'pzs', cost: 0.6, minStock: 24, brandId: b1.id } });

  // Burger Peak Products
  const prodB1 = await prisma.product.create({
    data: {
      name: 'Hamburguesa Sencilla',
      description: 'Carne de res de 150g, pan brioche y queso cheddar fundido.',
      price: 6.99,
      categoryId: catB1.id,
      brandId: b1.id,
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&fit=crop&q=80',
    },
  });
  const prodB2 = await prisma.product.create({
    data: {
      name: 'Hamburguesa con Tocino',
      description: 'Doble tocino ahumado, queso cheddar y carne de res 150g.',
      price: 8.49,
      categoryId: catB1.id,
      brandId: b1.id,
      imageUrl: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&fit=crop&q=80',
    },
  });
  const prodB3 = await prisma.product.create({
    data: {
      name: 'Hamburguesa Doble Queso',
      description: 'Doble porción de carne 150g y 4 rebanadas de queso cheddar.',
      price: 9.99,
      categoryId: catB1.id,
      brandId: b1.id,
      imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&fit=crop&q=80',
    },
  });
  const prodB4 = await prisma.product.create({
    data: {
      name: 'Papas Fritas Medianas',
      description: 'Papas fritas crujientes sazonadas con sal de mar.',
      price: 2.99,
      categoryId: catB2.id,
      brandId: b1.id,
      imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&fit=crop&q=80',
    },
  });
  const prodB5 = await prisma.product.create({
    data: {
      name: 'Refresco Cola',
      description: 'Refresco frío en lata de 355ml.',
      price: 1.50,
      categoryId: catB3.id,
      brandId: b1.id,
      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&fit=crop&q=80',
    },
  });

  // Recipes for Burger Peak
  await prisma.recipeItem.create({ data: { productId: prodB1.id, ingredientId: ingMeat.id, quantity: 1 } });
  await prisma.recipeItem.create({ data: { productId: prodB1.id, ingredientId: ingBun.id, quantity: 1 } });
  await prisma.recipeItem.create({ data: { productId: prodB1.id, ingredientId: ingCheese.id, quantity: 1 } });

  await prisma.recipeItem.create({ data: { productId: prodB2.id, ingredientId: ingMeat.id, quantity: 1 } });
  await prisma.recipeItem.create({ data: { productId: prodB2.id, ingredientId: ingBun.id, quantity: 1 } });
  await prisma.recipeItem.create({ data: { productId: prodB2.id, ingredientId: ingCheese.id, quantity: 1 } });
  await prisma.recipeItem.create({ data: { productId: prodB2.id, ingredientId: ingBacon.id, quantity: 2 } });

  await prisma.recipeItem.create({ data: { productId: prodB3.id, ingredientId: ingMeat.id, quantity: 2 } });
  await prisma.recipeItem.create({ data: { productId: prodB3.id, ingredientId: ingBun.id, quantity: 1 } });
  await prisma.recipeItem.create({ data: { productId: prodB3.id, ingredientId: ingCheese.id, quantity: 4 } });

  await prisma.recipeItem.create({ data: { productId: prodB4.id, ingredientId: ingPotato.id, quantity: 0.2 } }); // 200g
  await prisma.recipeItem.create({ data: { productId: prodB5.id, ingredientId: ingSoda.id, quantity: 1 } });

  // Add more products to make it 10-15 per brand (omitting recipe details for simplicity in remaining)
  for (let i = 6; i <= 15; i++) {
    await prisma.product.create({
      data: {
        name: `Burger Special Edition ${i}`,
        description: `Deliciosa variante de hamburguesa edición especial #${i}.`,
        price: 7.99 + i * 0.2,
        categoryId: catB1.id,
        brandId: b1.id,
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&fit=crop&q=80',
      },
    });
  }

  console.log('Burger Peak seeded. Seeding Brand 2: Taco Express (Mexican)...');

  // 4. Taco Express Categories
  const catT1 = await prisma.category.create({ data: { name: 'Tacos', brandId: b2.id } });
  const catT2 = await prisma.category.create({ data: { name: 'Quesadillas', brandId: b2.id } });
  const catT3 = await prisma.category.create({ data: { name: 'Bebidas', brandId: b2.id } });

  // Taco Express Ingredients
  const ingTortilla = await prisma.ingredient.create({ data: { name: 'Tortilla de Maíz (kg)', stock: 30.0, unit: 'kg', cost: 1.0, minStock: 5.0, brandId: b2.id } });
  const ingSteak = await prisma.ingredient.create({ data: { name: 'Carne Asada de Res (kg)', stock: 20.0, unit: 'kg', cost: 8.5, minStock: 4.0, brandId: b2.id } });
  const ingCilantro = await prisma.ingredient.create({ data: { name: 'Cilantro picado (kg)', stock: 5.0, unit: 'kg', cost: 0.5, minStock: 1.0, brandId: b2.id } });
  const ingSalsa = await prisma.ingredient.create({ data: { name: 'Salsa Taquera (L)', stock: 15.0, unit: 'L', cost: 2.0, minStock: 3.0, brandId: b2.id } });

  // Taco Express Products
  const prodT1 = await prisma.product.create({
    data: {
      name: 'Taco de Asada',
      description: 'Taco con doble tortilla, carne asada, cebolla, cilantro y salsa.',
      price: 1.99,
      categoryId: catT1.id,
      brandId: b2.id,
      imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&fit=crop&q=80',
    },
  });
  const prodT2 = await prisma.product.create({
    data: {
      name: 'Quesadilla Especial',
      description: 'Tortilla grande de harina con queso fundido y carne asada.',
      price: 4.99,
      categoryId: catT2.id,
      brandId: b2.id,
      imageUrl: 'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?w=400&fit=crop&q=80',
    },
  });

  // Recipes for Taco Express
  await prisma.recipeItem.create({ data: { productId: prodT1.id, ingredientId: ingTortilla.id, quantity: 0.05 } }); // 50g
  await prisma.recipeItem.create({ data: { productId: prodT1.id, ingredientId: ingSteak.id, quantity: 0.08 } }); // 80g
  await prisma.recipeItem.create({ data: { productId: prodT1.id, ingredientId: ingCilantro.id, quantity: 0.01 } });
  await prisma.recipeItem.create({ data: { productId: prodT1.id, ingredientId: ingSalsa.id, quantity: 0.02 } });

  // 10 more products for Taco Express
  for (let i = 3; i <= 15; i++) {
    await prisma.product.create({
      data: {
        name: `Taco Especial Combo ${i}`,
        description: `Delicioso taco especial al pastor o asada #${i}.`,
        price: 2.20 + i * 0.15,
        categoryId: catT1.id,
        brandId: b2.id,
        imageUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&fit=crop&q=80',
      },
    });
  }

  console.log('Taco Express seeded. Seeding Brand 3: Sushi Wave (Japanese)...');

  // 5. Sushi Wave Categories
  const catS1 = await prisma.category.create({ data: { name: 'Makis & Rolls', brandId: b3.id } });
  const catS2 = await prisma.category.create({ data: { name: 'Bowls', brandId: b3.id } });
  const catS3 = await prisma.category.create({ data: { name: 'Entradas', brandId: b3.id } });

  // Sushi Wave Ingredients
  const ingRice = await prisma.ingredient.create({ data: { name: 'Arroz Shari (kg)', stock: 50.0, unit: 'kg', cost: 1.8, minStock: 10.0, brandId: b3.id } });
  const ingSalmon = await prisma.ingredient.create({ data: { name: 'Salmón Fresco (kg)', stock: 12.0, unit: 'kg', cost: 18.0, minStock: 2.0, brandId: b3.id } });
  const ingNori = await prisma.ingredient.create({ data: { name: 'Alga Nori (pzs)', stock: 400, unit: 'pzs', cost: 0.12, minStock: 50, brandId: b3.id } });
  const ingAvocado = await prisma.ingredient.create({ data: { name: 'Aguacate (kg)', stock: 15.0, unit: 'kg', cost: 3.5, minStock: 3.0, brandId: b3.id } });

  // Sushi Wave Products
  const prodS1 = await prisma.product.create({
    data: {
      name: 'Philadelphia Roll',
      description: 'Salmón, queso crema, aguacate cubierto de ajonjolí.',
      price: 7.99,
      categoryId: catS1.id,
      brandId: b3.id,
      imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&fit=crop&q=80',
    },
  });
  const prodS2 = await prisma.product.create({
    data: {
      name: 'Poke Bowl Salmón',
      description: 'Base de arroz shari, edamames, aguacate, salmón y salsa ponzu.',
      price: 9.49,
      categoryId: catS2.id,
      brandId: b3.id,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&fit=crop&q=80',
    },
  });

  // Recipes for Sushi Wave
  await prisma.recipeItem.create({ data: { productId: prodS1.id, ingredientId: ingRice.id, quantity: 0.12 } }); // 120g
  await prisma.recipeItem.create({ data: { productId: prodS1.id, ingredientId: ingSalmon.id, quantity: 0.05 } }); // 50g
  await prisma.recipeItem.create({ data: { productId: prodS1.id, ingredientId: ingNori.id, quantity: 1 } });
  await prisma.recipeItem.create({ data: { productId: prodS1.id, ingredientId: ingAvocado.id, quantity: 0.03 } }); // 30g

  // 10 more products for Sushi Wave
  for (let i = 3; i <= 15; i++) {
    await prisma.product.create({
      data: {
        name: `Sushi Special Roll ${i}`,
        description: `Delicioso rollo especial de sushi con camarón o salmón #${i}.`,
        price: 8.50 + i * 0.25,
        categoryId: catS1.id,
        brandId: b3.id,
        imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&fit=crop&q=80',
      },
    });
  }

  console.log('Sushi Wave seeded. Seeding Transactions & Orders...');

  // 6. Active Cash session for Burger Peak
  const session = await prisma.cashSession.create({
    data: {
      brandId: b1.id,
      userId: cashier.id,
      openingBalance: 100.0,
      openedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // Opened 3h ago
      status: 'OPEN',
    },
  });

  // 7. Seed Orders
  // Yesterday order (delivered)
  const order1 = await prisma.order.create({
    data: {
      orderNumber: 'DF-1001',
      brandId: b1.id,
      source: 'UBER_EATS',
      status: 'DELIVERED',
      customerName: 'Juan Pérez',
      customerPhone: '555-0192',
      customerAddress: 'Av. Reforma 102, Coyoacán',
      notes: 'Sin cebolla por favor.',
      subtotal: 15.48,
      tax: 2.48,
      tip: 2.00,
      total: 19.96,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      driverId: driver1.id,
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order1.id, productId: prodB1.id, quantity: 1, price: 6.99 },
      { orderId: order1.id, productId: prodB2.id, quantity: 1, price: 8.49 },
    ],
  });

  // Active preparation order for Burger Peak (RECEIVED)
  const order2 = await prisma.order.create({
    data: {
      orderNumber: 'DF-1002',
      brandId: b1.id,
      source: 'WEB',
      status: 'PREPARING',
      customerName: 'Sofía López',
      customerPhone: '555-0143',
      customerAddress: 'Calle Roble 45, Del Valle',
      notes: 'Papas muy crujientes.',
      subtotal: 9.98,
      tax: 1.60,
      tip: 1.00,
      total: 12.58,
      createdAt: new Date(Date.now() - 12 * 60 * 1000), // 12 mins ago
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order2.id, productId: prodB1.id, quantity: 1, price: 6.99 },
      { orderId: order2.id, productId: prodB4.id, quantity: 1, price: 2.99 },
    ],
  });

  // Ready order waiting for driver delivery
  const order3 = await prisma.order.create({
    data: {
      orderNumber: 'DF-1003',
      brandId: b1.id,
      source: 'PHONE',
      status: 'READY',
      customerName: 'Roberto Gómez',
      customerPhone: '555-0187',
      customerAddress: 'Guanajuato 12, Roma Norte',
      subtotal: 16.98,
      tax: 2.72,
      tip: 1.50,
      total: 21.20,
      createdAt: new Date(Date.now() - 35 * 60 * 1000), // 35 mins ago
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order3.id, productId: prodB3.id, quantity: 1, price: 9.99 },
      { orderId: order3.id, productId: prodB1.id, quantity: 1, price: 6.99 },
    ],
  });

  // Taco Express Order
  const order4 = await prisma.order.create({
    data: {
      orderNumber: 'DF-1004',
      brandId: b2.id,
      source: 'RAPPI',
      status: 'DELIVERED',
      customerName: 'Miguel Domínguez',
      customerAddress: 'Plaza Carso, Polanco',
      subtotal: 8.97,
      tax: 1.44,
      tip: 1.00,
      total: 11.41,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order4.id, productId: prodT1.id, quantity: 2, price: 1.99 },
      { orderId: order4.id, productId: prodT2.id, quantity: 1, price: 4.99 },
    ],
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
