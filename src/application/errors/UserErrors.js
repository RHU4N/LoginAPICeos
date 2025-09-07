// Classe com erros personalizados para usuários

class UserErrors extends Error{
    constructor(message, statusCode = 400) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

class UserNotFoundError extends UserError {
    constructor(message = "Usuário não encontrado") {
        super(message, 404);
    }
}

class MissingFieldsError extends UserError {
    constructor(message = "Campos obrigatórios faltando") {
        super(message, 400);
    }
}


module.exports = {
    UserErrors,
    UserNotFoundError,
    MissingFieldsError,
};