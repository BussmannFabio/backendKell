import jwt from "jsonwebtoken";
import { User, Role } from "../models/index.js";

export const autenticar = async (req, res, next) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token não fornecido" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "segredo");
    const usuario = await User.findByPk(decoded.id, { include: ["role"] });
    if (!usuario) return res.status(401).json({ error: "Usuário inválido" });

    req.usuario = usuario;
    next();
  } catch (err) {
    console.error("[AUTH]", err);
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};
