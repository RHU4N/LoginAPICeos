const { ValidationError } = require("../../errors/AppError")

class FormulaValidator {
    static validate(formula, parametros = []) {
        if ( !formula || typeof formula !== "string") {
            throw new ValidationError("Fórmula é obrigatória")
        }

        const formulaLimpa = formula.trim();

        if (!formulaLimpa) {
            throw new ValidationError("Fórmula não pode estar vazia");
        }

        this.validateCharacters(formulaLimpa);
        this.validateParentheses(formulaLimpa);
        this.validateVariables(formulaLimpa, parametros);
        this.validateOperators(formulaLimpa);

        return true;
    }

    static validateCharacters(formula) {
        const caracteresPermitidos = /^[a-zA-Z0-9_+\-*/().\s]+$/;

        if (!caracteresPermitidos.test(formula)) {
            throw new ValidationError(
                "Fórmula contém caracteres não permitidos"
            );
        }
    }

    static validateParentheses(formula) {
        let balance = 0;

        for (const char of formula) {
            if (char === "(") balance++;

            if (char === ")") {
                balance--;

                if (balance < 0) {
                    throw new ValidationError(
                        "Parênteses inválidos na fórmula"
                    );
                }
            }
        }

        if (balance !== 0) {
            throw new ValidationError(
                "Parênteses inválidos na fórmula"
            );
        }
    }

    static validateVariables(formula, parametros) {
        const nomesParametros = parametros.map(
            (parametro) => parametro.nome
        );

        const tokens = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];

        const variaveisInvalidas = tokens.filter(
            (token) => !nomesParametros.includes(token)
        );

        if (variaveisInvalidas.length > 0) {
            throw new ValidationError(
                `Variável não declarada: ${variaveisInvalidas[0]}`
            );
        }
    }


    static validateOperators(formula) {
    const formulaSemEspacos = formula.replace(/\s+/g, "");
    const operadoresConsecutivos = /[+\-*/]{2,}/;

    if (operadoresConsecutivos.test(formulaSemEspacos)) {
        throw new ValidationError(
            "Fórmula contém operadores consecutivos inválidos"
        );
    }
}
}

module.exports = FormulaValidator;