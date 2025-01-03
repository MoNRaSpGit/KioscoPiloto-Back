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
  origin: "*", // Permitir cualquier origen
  methods: ["GET", "POST", "PUT", "DELETE"], // Métodos permitidos
  allowedHeaders: ["Content-Type", "Authorization"], // Cabeceras permitidas
  credentials: true, // Permitir envío de credenciales (cookies, auth headers, etc.)
};
app.use(cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json());

// Configuración de WebSockets
const io = new Server(server, {
  cors: {
    origin: "*", // Permitir cualquier origen para WebSockets
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
  const newSubscription = req.body;

  // Verifica si la suscripción ya existe
  const subscriptionExists = subscriptions.some(
    (sub) => sub.endpoint === newSubscription.endpoint
  );

  if (subscriptionExists) {
    console.log("Suscripción ya registrada.");
    return res.status(200).json({ message: "Suscripción ya existe" });
  }

  subscriptions.push(newSubscription);
  console.log("Suscripción registrada:", newSubscription);
  res.status(201).json({ message: "Suscripción registrada con éxito" });
});


// Endpoint para enviar una notificación
app.post("/send-notification", (req, res) => {
  const { title, message } = req.body;

  const payload = JSON.stringify({ title, message });

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






// Endpoint para obtener pedidos
app.get("/api/orders", async (req, res) => {
  console.log("Solicitud GET recibida en '/api/orders'");

  const query = `
    SELECT o.id, o.created_at, o.status, 
           JSON_ARRAYAGG(JSON_OBJECT(
             'id', d.product_id, 
             'name', p.name, 
             'price', d.price, 
             'quantity', d.quantity
           )) AS productos
    FROM orders o
    JOIN order_details d ON o.id = d.order_id
    JOIN products p ON p.id = d.product_id
    GROUP BY o.id;
  `;

  try {
    const [results] = await db.query(query);

    if (results.length === 0) {
      return res.status(404).json({ message: "No hay pedidos disponibles." });
    }

    console.log("Pedidos obtenidos correctamente:", results);
    res.json(results);
  } catch (err) {
    console.error("Error al obtener los pedidos:", err);
    res.status(500).json({ error: "Error al obtener los pedidos." });
  }
});






// Endpoint básico para probar la conexión
app.get("/", (req, res) => {
  console.log("Solicitud GET recibida en '/'");
  res.send("Bienvenido al backend de MercadoYa!");
});

// Endpoint para obtener productos
app.get("/api/products", async (req, res) => {
  console.log("Solicitud GET recibida en '/api/products'");

  try {
    const [results] = await db.query("SELECT * FROM products");
    console.log("Productos obtenidos correctamente:", results);
    res.json(results);
  } catch (err) {
    console.error("Error al obtener los productos:", err);
    res.status(500).json({ error: "Error al obtener los productos." });
  }
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

  if (!userId || !products || products.length === 0) {
    return res.status(400).json({ error: "Datos inválidos para el pedido." });
  }

  try {
    const [orderResult] = await db.query("INSERT INTO orders (user_id) VALUES (?)", [userId]);
    const orderId = orderResult.insertId;

    const orderDetailsData = products.map((product) => [
      orderId,
      product.id,
      product.quantity,
      product.price,
    ]);

    await db.query(
      `INSERT INTO order_details (order_id, product_id, quantity, price) VALUES ?`,
      [orderDetailsData]
    );

    const newOrder = {
      id: orderId,
      user_id: userId,
      products,
      created_at: new Date().toISOString(),
      status: "Pendiente",
    };

    io.emit("new_order", newOrder); // Emitir evento de nueva orden
    console.log("Nueva orden emitida por WebSocket:", newOrder);

    res.status(201).json({ message: "Pedido registrado con éxito.", orderId });
  } catch (err) {
    console.error("Error al registrar el pedido:", err);
    res.status(500).json({ error: "Error al registrar el pedido." });
  }
});

// Endpoint para actualizar el estado del pedido
app.put("/api/orders/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["Pendiente", "Procesando", "Listo"].includes(status)) {
    return res.status(400).json({ error: "Estado inválido." });
  }

  try {
    const [result] = await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pedido no encontrado." });
    }

    io.emit("order_status_updated", { id, status }); // Emitir evento de actualización de estado
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


