const mongoose = require('mongoose');

const mongoUri = process.env.mongoUri ||'mongodb+srv://Rhuan:root@ceos.htu7dfp.mongodb.net/?retryWrites=true&w=majority&appName=Ceos';
if (!mongoUri) {
    console.error('Erro: MONGODB_URI não está definido no arquivo .env');
    process.exit(1); // Finaliza o processo se a URI não estiver definida
}

mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Conexão com o MongoDB estabelecida com sucesso!'))
    .catch((err) => {
        console.error('Erro ao conectar ao MongoDB:', err.message);
        process.exit(1); // Finaliza o processo em caso de erro
    });

module.exports = mongoose.connection;