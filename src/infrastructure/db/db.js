const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://Rhuan:root@ceos.htu7dfp.mongodb.net/?retryWrites=true&w=majority&appName=Ceos', {});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Erro de conexão com o MongoDB: '));
db.once('open', function () {
    console.log('Conexão com o MongoDB estabelecida com sucesso!');
});
module.exports = db;