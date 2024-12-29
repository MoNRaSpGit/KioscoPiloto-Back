const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./db"); // Importa la conexión a la base de datos

const app = express();

// Configuración de CORS
const corsOptions = {
  origin: "*", // Permite solicitudes desde cualquier origen
  methods: ["GET", "POST", "PUT", "DELETE"], // Métodos permitidos
  credentials: true, // Permite cookies y encabezados personalizados
};
app.use(cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json());

// Endpoint básico para probar la conexión
app.get("/", (req, res) => {
  console.log("Solicitud GET recibida en '/'"); // Log para depuración
  res.send("Bienvenido al backend de MercadoYa!");
});

// Endpoint para obtener productos
app.get("/api/products", (req, res) => {
  console.log("Solicitud GET recibida en '/api/products'"); // Log para depuración
  db.query("SELECT * FROM products", (err, results) => {
    if (err) {
      console.error("Error al obtener los productos:", err);
      return res.status(500).json({ error: "Error al obtener los productos." });
    }
    console.log("Productos obtenidos correctamente:", results); // Log de datos obtenidos
    res.json(results);
  });
});

// Registro de usuario (sin bcrypt)
app.post("/api/register", (req, res) => {
  const { name, email, password, role } = req.body;

  db.query(
    "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
    [name, email, password, role || "user"],
    (err, results) => {
      if (err) {
        console.error("Error al registrar el usuario:", err);
        return res.status(500).json({ error: "Error al registrar el usuario." });
      }
      res.status(201).json({ message: "Usuario registrado con éxito." });
    }
  );
});




// Login de usuario (sin bcrypt)
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, results) => {
    if (err) {
      console.error("Error al buscar el usuario:", err);
      return res.status(500).json({ error: "Error interno del servidor." });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }

    const user = results[0];
    res.json({ message: "Login exitoso.", user });
  });
});

// Configurar el puerto
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
