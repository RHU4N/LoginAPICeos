const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, {});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Erro de conexão com o MongoDB: '));
db.once('open', function () {
    console.log('Conexão com o MongoDB estabelecida com sucesso!');
});
module.exports = db;