// Controlador CRUD para Usuarios
exports.getAll = (req, res) => res.send('Listar usuarios');
exports.getById = (req, res) => res.send('Obtener usuario por ID');
exports.create = (req, res) => res.send('Crear usuario');
exports.update = (req, res) => res.send('Actualizar usuario');
exports.delete = (req, res) => res.send('Eliminar usuario');
