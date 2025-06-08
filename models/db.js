const mongoose = require('mongoose');
// Conexão com o banco de dados MongoDB
    mongoose.connect('mongodb+srv://Rhuan:root@ceos.htu7dfp.mongodb.net/?retryWrites=true&w=majority&appName=Ceos', {
    });
// Obter a conexão padrão do Mongoose
    const db = mongoose.connection;
// Adicionar um listener de eventos para verificar se há erros na conexão
    db.on('error', console.error.bind(console, 'Erro de conexão com o MongoDB: '));
// Adicionar um listener de eventos para verificar se a conexão foi estabelecida com sucesso
    db.once('open', function () {
        console.log('Conexão com o MongoDB estabelecida com sucesso!');
    });
// Vamos exportar a conexão com o banco de dados MongoDB
module.exports = db;
