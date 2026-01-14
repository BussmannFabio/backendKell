// src/routes/vendedores.routes.js
import { Router } from 'express';
import VendedorController from '../controllers/vendedor-controller.js'; 

const vendedorRoutes = Router();

// Rotas CRUD
vendedorRoutes.post('/', VendedorController.create);       // CREATE
vendedorRoutes.get('/', VendedorController.index);         // READ ALL
vendedorRoutes.get('/:id', VendedorController.show);       // READ ONE
vendedorRoutes.put('/:id', VendedorController.update);     // UPDATE
vendedorRoutes.delete('/:id', VendedorController.destroy); // DELETE

export default vendedorRoutes;
