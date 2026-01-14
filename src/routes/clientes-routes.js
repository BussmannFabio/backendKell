// src/routes/clientes.routes.js
import { Router } from 'express';
import ClienteController from '../controllers/cliente-controller.js';

const clienteRoutes = Router();

// Rotas CRUD
clienteRoutes.post('/', ClienteController.create);       // CREATE
clienteRoutes.get('/', ClienteController.index);         // READ ALL
clienteRoutes.get('/:id', ClienteController.show);       // READ ONE
clienteRoutes.put('/:id', ClienteController.update);     // UPDATE
clienteRoutes.delete('/:id', ClienteController.destroy); // DELETE

export default clienteRoutes;
