const express = require("express");
const cors = require("cors");
require("dotenv").config();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { authenticateToken, authorize } = require("./middlewares/auth");
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

// Registro de usuario con rol
app.post("/api/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  console.log("Solicitud POST recibida en '/api/register' con datos:", req.body); // Log de datos

  try {
    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
      if (err) {
        console.error("Error al verificar el usuario:", err);
        return res.status(500).json({ error: "Error al verificar el usuario." });
      }

      if (results.length > 0) {
        return res.status(400).json({ error: "El usuario ya existe." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      db.query(
        "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, role || "user"],
        (err, results) => {
          if (err) {
            console.error("Error al registrar el usuario:", err);
            return res.status(500).json({ error: "Error al registrar el usuario." });
          }

          console.log("Usuario registrado con éxito:", { name, email, role });
          res.status(201).json({ message: "Usuario registrado con éxito." });
        }
      );
    });
  } catch (error) {
    console.error("Error interno del servidor:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Login de usuario
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  console.log("Solicitud POST recibida en '/api/login' con datos:", { email }); // Log de datos

  try {
    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
      if (err) {
        console.error("Error al buscar el usuario:", err);
        return res.status(500).json({ error: "Error interno del servidor." });
      }

      if (results.length === 0) {
        console.warn("Credenciales inválidas para el correo:", email);
        return res.status(401).json({ error: "Correo o contraseña incorrectos." });
      }

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        console.warn("Contraseña incorrecta para el usuario:", email);
        return res.status(401).json({ error: "Correo o contraseña incorrectos." });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "1h" }
      );

      console.log("Login exitoso para el usuario:", email);
      res.json({ message: "Login exitoso.", token, role: user.role });
    });
  } catch (error) {
    console.error("Error interno del servidor:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Configurar el puerto
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
