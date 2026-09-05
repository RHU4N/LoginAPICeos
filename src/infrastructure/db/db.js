const mongoose = require('mongoose');
const dns = require('node:dns');

// MONGO_URI is the documented setting. Keep mongoUri temporarily for older
// local .env files while they are migrated.
const mongoUri = process.env.MONGO_URI || process.env.mongoUri;
if (!mongoUri) {
    console.error('Erro: MONGODB_URI não está definido no arquivo .env');
    process.exit(1); // Finaliza o processo se a URI não estiver definida
}

// Node's DNS resolver may differ from the Windows encrypted-DNS resolver.
// Allow a dedicated resolver for Atlas SRV discovery when the default rejects it.
if (mongoUri.startsWith('mongodb+srv://')) {
    dns.setServers([process.env.MONGODB_DNS_SERVER || '1.1.1.1']);
}

mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10_000,
})
    .then(() => console.log('Conexão com o MongoDB estabelecida com sucesso!'))
    .catch((err) => {
        console.error('Erro ao conectar ao MongoDB:', err.message);
        process.exit(1); // Finaliza o processo em caso de erro
    });

module.exports = mongoose.connection;
