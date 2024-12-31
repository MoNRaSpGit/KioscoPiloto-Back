const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db"); // Importa la conexión a la base de datos

const app = express();

// Configuración de CORS
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json());

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
    // Validar los campos requeridos
    if (!name || !password || !direccion) {
      return res.status(400).json({ error: "Todos los campos son obligatorios." });
    }

    const [results] = await db.query(
      "INSERT INTO users (name, password, direccion, role) VALUES (?, ?, ?, ?)",
      [name, password, direccion, "user"] // Rol siempre será 'user'
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
    // Validar los campos requeridos
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

    const user = results[0]; // Extraer al usuario encontrado
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

    res.status(201).json({ message: "Pedido registrado con éxito.", orderId });
  } catch (err) {
    console.error("Error al registrar el pedido:", err);
    res.status(500).json({ error: "Error al registrar el pedido." });
  }
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
    console.log("Pedidos obtenidos correctamente:", results);
    res.json(results);
  } catch (err) {
    console.error("Error al obtener los pedidos:", err);
    res.status(500).json({ error: "Error al obtener los pedidos." });
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

    console.log(`Estado del pedido ${id} actualizado a ${status}`);
    res.json({ message: "Estado actualizado con éxito.", status });
  } catch (err) {
    console.error(`Error al actualizar el estado del pedido ${id}:`, err);
    res.status(500).json({ error: "Error al actualizar el estado del pedido." });
  }
});


/// Endpoint para eliminar un pedido
app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Elimina detalles
    await db.query('DELETE FROM order_details WHERE order_id = ?', [id]);

    // Elimina pedido
    await db.query('DELETE FROM orders WHERE id = ?', [id]);

    console.log(`Pedido ${id} eliminado correctamente.`);
    res.json({ message: 'Pedido eliminado con éxito.' });

  } catch (err) {
    console.error(`Error al eliminar el pedido ${id}:`, err);
    res.status(500).json({ error: 'Error al eliminar el pedido.' });
  }
});



// Endpoint para agregar un producto
app.post("/api/products", async (req, res) => {
  const { name, price, barcode } = req.body; // Eliminamos `image` de los datos requeridos

  try {
    const [result] = await db.query(
      "INSERT INTO products (name, price, image, barcode) VALUES (?, ?, NULL, ?)",
      [name, price, barcode] // Pasamos NULL para `image`
    );
    res.status(201).json({ message: "Producto agregado con éxito.", id: result.insertId });
  } catch (err) {
    console.error("Error al agregar el producto:", err);
    res.status(500).json({ error: "Error al agregar el producto." });
  }
});







// Configurar el puerto
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
