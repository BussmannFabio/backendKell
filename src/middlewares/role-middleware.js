export const autorizar = (roles = []) => {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: "Não autenticado" });

    if (!roles.includes(req.usuario.role.nome)) {
      return res.status(403).json({ error: "Acesso negado" });
    }

    next();
  };
};
