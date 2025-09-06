const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true },
    senha: { type: String, required: true },
    telefone: { type: String, required: true },
    assinante: { type: Boolean, default: false, required: true },
    historico: [{
        tipo: { type: String, required: false },
        valores: { type: String, required: false },
        resultado: { type: String, required: false },
        data: { type: Date, default: Date.now }
    }]
}, { collection: 'User' });

const User = mongoose.model('User', UserSchema);
module.exports = User;