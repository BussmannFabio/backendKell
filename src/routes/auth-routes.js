import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User, Role } from "../models/index.js";

const router = express.Router();

// Registro de usuário
router.post("/register", async (req, res) => {
  try {
    const { nome, senha, roleId } = req.body;
    if (!nome || !senha) return res.status(400).json({ error: "nome e senha são obrigatórios" });

    const existente = await User.findOne({ where: { nome } });
    if (existente) return res.status(409).json({ error: "Nome já cadastrado" });

    // Verifica se roleId existe
    const role = await Role.findByPk(roleId);
    if (!role) return res.status(400).json({ error: "Role inválida" });

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await User.create({ nome, senhaHash, roleId: role.id });

    res.status(201).json({ 
      id: usuario.id, 
      nome: usuario.nome, 
      role: role.nome 
    });
  } catch (err) {
    console.error("[AUTH][REGISTER]", err);
    res.status(500).json({ error: "Erro ao registrar usuário" });
  }
});

// Login de usuário
router.post("/login", async (req, res) => {
  try {
    const { nome, senha } = req.body;
    if (!nome || !senha) return res.status(400).json({ error: "nome e senha são obrigatórios" });

    const usuario = await User.findOne({ 
      where: { nome },
      include: [{ model: Role, as: "role" }] // garante que role venha junto
    });

    if (!usuario) return res.status(401).json({ error: "Credenciais inválidas" });

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) return res.status(401).json({ error: "Credenciais inválidas" });

    // Cria token com role correta
    const token = jwt.sign(
      { id: usuario.id, role: usuario.role ? usuario.role.nome : null },
      process.env.JWT_SECRET || "segredo",
      { expiresIn: "8h" }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role ? usuario.role.nome : null }
    });
  } catch (err) {
    console.error("[LOGIN]", err);
    res.status(500).json({ error: "Erro no login" });
  }
});

export default router;
