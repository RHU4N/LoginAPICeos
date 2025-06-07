// Importando a conexão com o banco de dados
const db = require('./db');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
// Definindo o esquema do modelo Proprietario com tudo
const UserSchema = new Schema({
    nome: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    senha: {
        type: String,
        required: true
    },
    telefone: {
        type: String,
        required: true
    },
    assinante: {
        type: Boolean,
        default: false, // Definindo o valor padrão como false
        required: true
    },
    historico: [{
        tipo:{
            type: String,
            required: false
        },
        valores:{
            type: String,
            required: false
        },
        resultado:{
            type: String,
            required: false
        },
        data:{
            type: Date,
            default: Date.now // Definindo o valor padrão como a data atual
        }
        
    }]
}, { collection: 'User' }); // Especificando o nome da coleção como 'Proprietario'
// Criando o modelo Proprietario baseado no esquema
const User = mongoose.model("User", UserSchema);
// Exportando o modelo Proprietario
module.exports = User