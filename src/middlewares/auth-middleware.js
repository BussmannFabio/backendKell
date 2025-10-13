// src/middlewares/auth-middleware.js
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

export const autenticar = async (req, res, next) => {
  try {
    const header = req.headers['authorization'] || '';
    console.log('[AUTH] header:', header);
    const token = header.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'segredo');
    } catch (err) {
      console.error('[AUTH] verify error:', err);
      return res.status(401).json({ error: err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token inválido' });
    }

    const usuario = await User.findByPk(decoded.id, { include: ['role'] });
    if (!usuario) return res.status(401).json({ error: 'Usuário inválido' });

    req.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role?.nome || null
    };

    next();
  } catch (err) {
    console.error('[AUTH]', err);
    return res.status(500).json({ error: 'Erro no middleware de autenticação' });
  }
};

export const autorizar = (rolesPermitidos = []) => {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'Usuário não autenticado' });
    if (!rolesPermitidos || rolesPermitidos.length === 0) return next();
    if (!rolesPermitidos.includes(req.usuario.role)) return res.status(403).json({ error: 'Acesso negado' });
    next();
  };
};
