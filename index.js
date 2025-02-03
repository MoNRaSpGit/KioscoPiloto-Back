const express = require("express");
const cors = require("cors");
require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const webPush = require("web-push");

const db = require("./db"); // Importa la conexión a la base de datos

const app = express();
const server = http.createServer(app);

// Configuración de CORS
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = ["https://monraspgit.github.io", "http://localhost:3000"];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // Permite cookies y credenciales
};



app.use(cors(corsOptions));

app.options("*", cors(corsOptions));





// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de WebSockets
const io = new Server(server, {
  cors: {
    origin: ["https://monraspgit.github.io", "http://localhost:3000"], // Dominio permitido
    methods: ["GET", "POST"], // Métodos permitidos
  },
});




io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });
});

module.exports = { app, server };


//-----  NOTIFICACIONES PUSH

// Configurar las claves VAPID
webPush.setVapidDetails(
  "mailto:ju4nrsuarez@gmail.com", // Cambia esto por tu email
  process.env.VAPID_PUBLIC_KEY, // Clave pública (colócala en tu .env)
  process.env.VAPID_PRIVATE_KEY // Clave privada (colócala en tu .env)
);

const subscriptions = []; // Almacena temporalmente las suscripciones (puedes usar tu base de datos)

// Endpoint para registrar una suscripción
app.post("/subscribe", (req, res) => {
  console.log("Suscripción recibida en el backend:", req.body); // Log para verificar
  subscriptions.push(req.body);
  res.status(201).json({ message: "Suscripción registrada con éxito" });
});


// Endpoint para enviar una notificación
app.post("/send-notification", (req, res) => {
  const { title, message } = req.body;

  const payload = JSON.stringify({
    title,
    message,
  });

  subscriptions.forEach((subscription, index) => {
    webPush
      .sendNotification(subscription, payload)
      .then(() => console.log(`Notificación enviada a la suscripción ${index}`))
      .catch((error) => {
        console.error(`Error al enviar notificación a la suscripción ${index}:`, error);
        // Elimina suscripciones inválidas
        if (error.statusCode === 410) {
          console.log("Eliminando suscripción inválida.");
          subscriptions.splice(index, 1);
        }
      });
  });

  res.status(200).json({ message: "Notificación enviada a todos los usuarios" });
});




const path = require("path");

// Servir archivos estáticos desde "public"
app.use(express.static(path.join(__dirname, "public")));

// Asegurar que el archivo "sw.js" se sirva correctamente
app.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "sw.js"));
});



// Endpoint para obtener un producto por código de barras
app.get('/api/products/:barcode', async (req, res) => {
  const { barcode } = req.params;

  try {
    const query = `SELECT * FROM products WHERE barcode = ?`;
    const [results] = await db.query(query, [barcode]);

    if (results.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    const product = results[0];

    // Convertir price a número para evitar problemas en el frontend
    product.price = parseFloat(product.price);

    res.json(product);
  } catch (err) {
    console.error('Error al obtener el producto:', err);
    res.status(500).json({ error: 'Error al obtener el producto.' });
  }
});

 // Endpoint para editar un producto
app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, barcode, price, image, description } = req.body;

  try {
    const query = `
      UPDATE products
      SET name = ?, barcode = ?, price = ?, image = ?, description = ?
      WHERE id = ?
    `;
    const [result] = await db.query(query, [name, barcode, price, image, description, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    res.json({ message: 'Producto editado con éxito.' });
  } catch (err) {
    console.error('Error al editar el producto:', err);
    res.status(500).json({ error: 'Error al editar el producto.' });
  }
});




// Endpoint para eliminar un producto
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Eliminar el producto por ID
    const query = `DELETE FROM products WHERE id = ?`;
    const [result] = await db.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    res.json({ message: 'Producto eliminado con éxito.' });
  } catch (err) {
    console.error('Error al eliminar el producto:', err);
    res.status(500).json({ error: 'Error al eliminar el producto.' });
  }
});






// Endpoint para guardar un producto con imagen
app.post("/api/products", async (req, res) => {
  const { name, barcode, price, description, image } = req.body;

  console.log("Datos recibidos en el backend:", req.body); // Log para verificar datos recibidos

  if (!name || !barcode) {
    return res.status(400).json({ error: "El nombre y el código de barras son obligatorios." });
  }

  try {
    const query = `
      INSERT INTO products (name, barcode, price, description, image)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      name,
      barcode,
      price || 0, // Valor predeterminado
      description || "", // Cadena vacía si no hay descripción
      image || null, // null si no hay imagen
    ]);

    console.log("Producto guardado en la base de datos con éxito:", { name, barcode }); // Log para confirmar éxito

    res.status(201).json({ message: "Producto guardado con éxito.", productId: result.insertId });
  } catch (err) {
    console.error("Error al guardar el producto:", err);
    res.status(500).json({ error: "Error al guardar el producto." });
  }
});




// Endpoint para obtener productos con imagen
app.get('/api/products', async (req, res) => {
  try {
    // Consulta que incluye las imágenes
    const [results] = await db.query(`SELECT id, name, barcode, price, description, image FROM products`);

    // Mapeo de los resultados para garantizar valores predeterminados
    const products = results.map((product) => ({
      ...product,
      price: product.price || 0, // Precio predeterminado si es null
      description: product.description || "", // Descripción predeterminada si es null
      image: product.image || "", // Imagen predeterminada si es null
    }));

    // Respuesta con los productos
    res.json(products);
  } catch (err) {
    console.error('Error al obtener los productos:', err);
    res.status(500).json({ error: 'Error al obtener los productos.' });
  }
});







// Endpoint para obtener pedidos
// Endpoint para obtener pedidos con imagen de productos
app.get("/api/orders", async (req, res) => {
  try {
    console.log("📥 Solicitud GET recibida en '/api/orders'");

    // 1️⃣ Obtener todos los pedidos SIN productos
    const [orders] = await db.query(`
      SELECT id, user_id, created_at, status 
      FROM orders 
      ORDER BY created_at DESC
    `);

    if (orders.length === 0) {
      return res.status(404).json({ message: "No hay pedidos disponibles." });
    }

    // 2️⃣ Obtener los productos de cada pedido (SIN agrupar)
    const [orderDetails] = await db.query(`
      SELECT d.order_id, d.product_id, p.name, p.image, d.price, d.quantity 
      FROM order_details d
      JOIN products p ON d.product_id = p.id
    `);

    // 3️⃣ Mapear los productos a cada pedido
    const pedidosConProductos = orders.map((pedido) => ({
      ...pedido,
      products: orderDetails
        .filter((detail) => detail.order_id === pedido.id)
        .map(({ order_id, ...rest }) => rest), // Quitamos el `order_id`
    }));

    console.log("✅ Pedidos obtenidos correctamente:", pedidosConProductos);
    res.json(pedidosConProductos);
  } catch (err) {
    console.error("❌ Error al obtener los pedidos:", err);
    res.status(500).json({ error: "Error al obtener los pedidos." });
  }
});







// Endpoint básico para probar la conexión
app.get("/", (req, res) => {
  console.log("Solicitud GET recibida en '/'");
  res.send("Bienvenido al backend de MercadoYa!");
});



// Registro de usuario
app.post("/api/register", async (req, res) => {
  const { name, password, direccion } = req.body;

  try {
    if (!name || !password || !direccion) {
      return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    const [results] = await db.query(
      "INSERT INTO users (name, password, direccion, role) VALUES (?, ?, ?, ?)",
      [name, password, direccion, "user"]
    );

    res.status(201).json({ message: "Usuario registrado con éxito." });
  } catch (err) {
    console.error("Error al registrar el usuario:", err);
    res.status(500).json({ error: "Error al registrar el usuario." });
  }
});

// Login de usuario
app.post("/api/login", async (req, res) => {
  const { name, password } = req.body;

  try {
    if (!name || !password) {
      return res.status(400).json({ error: "Nombre y contraseña son obligatorios." });
    }

    const [results] = await db.query(
      "SELECT * FROM users WHERE name = ? AND password = ?",
      [name, password]
    );

    if (results.length === 0) {
      return res.status(401).json({ error: "Nombre o contraseña incorrectos." });
    }

    const user = results[0];
    res.json({ message: "Login exitoso.", user });
  } catch (err) {
    console.error("Error al buscar el usuario:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});



// Endpoint para registrar un pedido
app.post("/api/orders", async (req, res) => {
  const { userId, products } = req.body;

  // ✅ Validar que userId y products sean correctos
  if (!userId || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: "Datos inválidos para el pedido." });
  }

  try {
    // 🔴 Insertar la orden en la tabla 'orders'
    const [orderResult] = await db.query("INSERT INTO orders (user_id) VALUES (?)", [userId]);
    const orderId = orderResult.insertId;

    // 🔴 Asegurar que los productos tienen la estructura correcta
    const orderDetailsData = products
      .filter((product) => product.id && product.quantity > 0 && product.price >= 0) // Validaciones
      .map((product) => [orderId, product.id, product.quantity, product.price]);

    if (orderDetailsData.length === 0) {
      return res.status(400).json({ error: "Productos inválidos en el pedido." });
    }

    // 🔴 Insertar los productos en la tabla 'order_details'
    await db.query(
      `INSERT INTO order_details (order_id, product_id, quantity, price) VALUES ?`,
      [orderDetailsData]
    );

    // ✅ Construir el objeto del nuevo pedido para la respuesta y WebSocket
    const newOrder = {
      id: orderId,
      userId,
      products,
      created_at: new Date().toISOString(),
      status: "Pendiente",
    };

    // ✅ Emitir evento WebSocket para actualizar en tiempo real
    io.emit("new_order", newOrder);

    console.log("✅ Nueva orden emitida por WebSocket:", newOrder);

    res.status(201).json({ message: "Pedido registrado con éxito.", order: newOrder });
  } catch (err) {
    console.error("❌ Error al registrar el pedido:", err);
    res.status(500).json({ error: "Error interno al registrar el pedido." });
  }
});


// Endpoint para actualizar el estado del pedido
// app.put("/api/orders/:id/status", async (req, res) => { ... })

app.put("/api/orders/:id/status", async (req, res) => {
  const { id } = req.params;       // el pedido se identifica por 'id'
  const { status } = req.body;

  if (!["Pendiente", "Procesando", "Listo"].includes(status)) {
    return res.status(400).json({ error: "Estado inválido." });
  }

  try {
    const [result] = await db.query(
      "UPDATE orders SET status = ? WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    // Notificar a todos los clientes WebSocket sobre el cambio de estado
    io.emit("order_status_updated", { id, status });
    console.log(`Estado del pedido ${id} actualizado a ${status}`);

    res.json({ message: "Estado actualizado con éxito.", status });
  } catch (err) {
    console.error(`Error al actualizar el estado del pedido ${id}:`, err);
    res.status(500).json({ error: "Error al actualizar el estado del pedido." });
  }
});



// Configurar el puerto
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});



