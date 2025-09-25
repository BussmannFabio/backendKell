// routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import { User, Role } from "../models/index.js";
import { autenticar } from "../middlewares/auth-middleware.js";
import { autorizar } from "../middlewares/role-middleware.js";

const router = express.Router();

// Criar usuário (apenas admin) - espera { nome, senha, roleId? }
router.post("/", autenticar, autorizar(["admin"]), async (req, res) => {
  try {
    const { nome, senha, roleId } = req.body;

    if (!nome || !senha) {
      return res.status(400).json({ error: "nome e senha são obrigatórios" });
    }

    // checar nome duplicado (já existe usuário com esse nome?)
    const existente = await User.findOne({ where: { nome } });
    if (existente) return res.status(409).json({ error: "Nome já cadastrado" });

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await User.create({ nome, senhaHash, roleId });

    const usuarioSafe = { id: usuario.id, nome: usuario.nome, roleId: usuario.roleId };
    res.status(201).json(usuarioSafe);
  } catch (err) {
    console.error("[USER][CREATE]", err);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

// Listar usuários (apenas admin)
router.get("/", autenticar, autorizar(["admin"]), async (req, res) => {
  try {
    const usuarios = await User.findAll({
      include: [{ model: Role, as: "role" }],
      attributes: { exclude: ['senhaHash'] }
    });
    res.json(usuarios);
  } catch (err) {
    console.error("[USER][LIST]", err);
    res.status(500).json({ error: "Erro ao listar usuários" });
  }
});

export default router;
