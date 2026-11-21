const { ValidationError } = require("../../errors/AppError");

const MAX_FORMULA_LENGTH = 500;
const MAX_TOKENS = 200;
const MAX_PAREN_DEPTH = 25;
const MAX_PARAMETERS = 20;
const PARAM_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,39}$/;

const RESERVED_JS_NAMES = new Set(["__proto__", "constructor", "prototype"]);

const CONSTANTS = Object.freeze({
  pi: Math.PI,
  e: Math.E,
});

const ALLOWED_FUNCTIONS = Object.freeze({
  sqrt: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => {
      if (x < 0) {
        throw new ValidationError("Resultado numérico inválido para os valores informados");
      }
      return Math.sqrt(x);
    },
  },
  abs: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => Math.abs(x),
  },
  sin: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => Math.sin(x),
  },
  cos: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => Math.cos(x),
  },
  tan: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => {
      const res = Math.tan(x);
      if (!Number.isFinite(res)) {
        throw new ValidationError("Divisão por zero ou operação indefinida");
      }
      return res;
    },
  },
  log: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => {
      if (x <= 0) {
        throw new ValidationError("Resultado numérico inválido para os valores informados");
      }
      return Math.log10(x);
    },
  },
  ln: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => {
      if (x <= 0) {
        throw new ValidationError("Resultado numérico inválido para os valores informados");
      }
      return Math.log(x);
    },
  },
  exp: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => {
      const res = Math.exp(x);
      if (!Number.isFinite(res)) {
        throw new ValidationError("Divisão por zero ou operação indefinida");
      }
      return res;
    },
  },
  pow: {
    minArgs: 2,
    maxArgs: 2,
    fn: ([a, b]) => computePower(a, b),
  },
  min: {
    minArgs: 2,
    maxArgs: Infinity,
    fn: (args) => Math.min(...args),
  },
  max: {
    minArgs: 2,
    maxArgs: Infinity,
    fn: (args) => Math.max(...args),
  },
  round: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => Math.round(x),
  },
  floor: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => Math.floor(x),
  },
  ceil: {
    minArgs: 1,
    maxArgs: 1,
    fn: ([x]) => Math.ceil(x),
  },
});

const ALLOWED_FUNCTION_NAMES = new Set(Object.keys(ALLOWED_FUNCTIONS));

function computePower(base, exponent) {
  if (base === 0 && exponent < 0) {
    throw new ValidationError("Divisão por zero ou operação indefinida");
  }
  const res = Math.pow(base, exponent);
  if (Number.isNaN(res)) {
    throw new ValidationError("Resultado numérico inválido para os valores informados");
  }
  if (!Number.isFinite(res)) {
    throw new ValidationError("Divisão por zero ou operação indefinida");
  }
  return res;
}

function isReservedName(name) {
  return (
    RESERVED_JS_NAMES.has(name) ||
    Object.prototype.hasOwnProperty.call(CONSTANTS, name) ||
    ALLOWED_FUNCTION_NAMES.has(name)
  );
}

function tokenize(formula) {
  if (!formula || typeof formula !== "string") {
    throw new ValidationError("Fórmula é obrigatória");
  }
  if (formula.length > MAX_FORMULA_LENGTH) {
    throw new ValidationError(`Fórmula excede o limite de ${MAX_FORMULA_LENGTH} caracteres`);
  }

  const source = formula.trim();
  if (!source) {
    throw new ValidationError("Fórmula não pode estar vazia");
  }

  const tokens = [];
  let i = 0;
  let parenDepth = 0;

  const pushToken = (token) => {
    tokens.push(token);
    if (tokens.length > MAX_TOKENS) {
      throw new ValidationError(`Fórmula excede o limite máximo de ${MAX_TOKENS} tokens`);
    }
  };

  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "+" || ch === "-" || ch === "*" || ch === "/" || ch === "^") {
      pushToken({ type: "OP", value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === "(") {
      parenDepth++;
      if (parenDepth > MAX_PAREN_DEPTH) {
        throw new ValidationError(`Profundidade máxima de parênteses excedida (máx. ${MAX_PAREN_DEPTH})`);
      }
      pushToken({ type: "LPAREN", value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === ")") {
      parenDepth--;
      if (parenDepth < 0) {
        throw new ValidationError("Parênteses desbalanceados na fórmula");
      }
      pushToken({ type: "RPAREN", value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch === ",") {
      pushToken({ type: "COMMA", value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    if (ch >= "0" && ch <= "9") {
      const start = i;
      while (i < source.length && source[i] >= "0" && source[i] <= "9") {
        i++;
      }
      if (i < source.length && source[i] === ".") {
        i++;
        if (i >= source.length || source[i] < "0" || source[i] > "9") {
          throw new ValidationError("Número decimal malformado na fórmula");
        }
        while (i < source.length && source[i] >= "0" && source[i] <= "9") {
          i++;
        }
      }
      if (i < source.length && source[i] === ".") {
        throw new ValidationError("Número decimal malformado na fórmula");
      }
      const raw = source.slice(start, i);
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        throw new ValidationError("Número fora do intervalo permitido");
      }
      pushToken({ type: "NUMBER", value: num, raw, start, end: i });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) {
        i++;
      }
      const ident = source.slice(start, i);
      if (RESERVED_JS_NAMES.has(ident)) {
        throw new ValidationError(`Identificador reservado não permitido: ${ident}`);
      }
      pushToken({ type: "IDENT", value: ident, start, end: i });
      continue;
    }

    throw new ValidationError(`Fórmula contém caracteres não permitidos: '${ch}'`);
  }

  if (parenDepth !== 0) {
    throw new ValidationError("Parênteses desbalanceados na fórmula");
  }

  return { source, tokens };
}

function parseTokens(tokens) {
  let pos = 0;
  const variablesSet = new Set();
  const variableTokenIndices = new Set();

  const peek = () => tokens[pos] || null;
  const consume = () => tokens[pos++];

  function parseExpression() {
    let node = parseTerm();
    while (peek() && peek().type === "OP" && (peek().value === "+" || peek().value === "-")) {
      const op = consume().value;
      const right = parseTerm();
      node = { type: "BinaryOp", op, left: node, right };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    while (peek() && peek().type === "OP" && (peek().value === "*" || peek().value === "/")) {
      const op = consume().value;
      const right = parseUnary();
      node = { type: "BinaryOp", op, left: node, right };
    }
    return node;
  }

  function parseUnary() {
    const token = peek();
    if (token && token.type === "OP" && (token.value === "+" || token.value === "-")) {
      consume();
      const operand = parseUnary();
      return { type: "UnaryOp", op: token.value, operand };
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    const token = peek();
    if (token && token.type === "OP" && token.value === "^") {
      consume();
      const exponent = parseUnary();
      return { type: "BinaryOp", op: "^", left: base, right: exponent };
    }
    return base;
  }

  function parsePrimary() {
    const token = peek();
    if (!token) {
      throw new ValidationError("Fórmula não pode terminar com operador");
    }

    if (token.type === "NUMBER") {
      consume();
      return { type: "NumberLiteral", value: token.value };
    }

    if (token.type === "IDENT") {
      const tokenIndex = pos;
      consume();
      const name = token.value;

      if (peek() && peek().type === "LPAREN") {
        if (!ALLOWED_FUNCTION_NAMES.has(name)) {
          throw new ValidationError(`Função desconhecida: ${name}`);
        }
        consume(); // '('
        const args = [];
        if (peek() && peek().type === "RPAREN") {
          consume();
        } else {
          args.push(parseExpression());
          while (peek() && peek().type === "COMMA") {
            consume();
            args.push(parseExpression());
          }
          if (!peek() || peek().type !== "RPAREN") {
            throw new ValidationError("Parênteses inválidos na chamada de função");
          }
          consume();
        }
        const spec = ALLOWED_FUNCTIONS[name];
        if (args.length < spec.minArgs || args.length > spec.maxArgs) {
          const esperado =
            spec.minArgs === spec.maxArgs
              ? `${spec.minArgs}`
              : `pelo menos ${spec.minArgs}`;
          throw new ValidationError(
            `Função '${name}' espera ${esperado} argumento(s), recebeu ${args.length}`,
          );
        }
        return { type: "FunctionCall", name, args };
      }

      if (ALLOWED_FUNCTION_NAMES.has(name)) {
        throw new ValidationError(`Função '${name}' deve ser chamada com parênteses`);
      }

      if (Object.prototype.hasOwnProperty.call(CONSTANTS, name)) {
        return { type: "Constant", name, value: CONSTANTS[name] };
      }

      variablesSet.add(name);
      variableTokenIndices.add(tokenIndex);
      return { type: "Variable", name };
    }

    if (token.type === "LPAREN") {
      consume();
      if (peek() && peek().type === "RPAREN") {
        throw new ValidationError("Fórmula contém parênteses vazios");
      }
      const expr = parseExpression();
      if (!peek() || peek().type !== "RPAREN") {
        if (peek() && peek().type === "COMMA") {
          throw new ValidationError("Vírgula permitida apenas entre argumentos de função");
        }
        throw new ValidationError("Parênteses desbalanceados na fórmula");
      }
      consume();
      return expr;
    }

    if (token.type === "OP") {
      throw new ValidationError(`Fórmula contém operador inválido: '${token.value}'`);
    }

    if (token.type === "COMMA") {
      throw new ValidationError("Vírgula permitida apenas entre argumentos de função");
    }

    throw new ValidationError(`Token inesperado na fórmula: '${token.value}'`);
  }

  const ast = parseExpression();
  if (pos < tokens.length) {
    const leftover = tokens[pos];
    if (leftover.type === "COMMA") {
      throw new ValidationError("Vírgula permitida apenas entre argumentos de função");
    }
    if (
      leftover.type === "NUMBER" ||
      leftover.type === "IDENT" ||
      leftover.type === "LPAREN"
    ) {
      throw new ValidationError("Fórmula contém operandos sem operador");
    }
    throw new ValidationError(`Token inesperado na fórmula: '${leftover.value}'`);
  }

  return {
    ast,
    variables: Array.from(variablesSet),
    variableTokenIndices,
  };
}

function parseInternal(formula) {
  const { source, tokens } = tokenize(formula);
  const { ast, variables, variableTokenIndices } = parseTokens(tokens);
  return { source, tokens, ast, variables, variableTokenIndices };
}

function validateParametersList(parametros) {
  if (!Array.isArray(parametros)) {
    throw new ValidationError("Parâmetros devem ser uma lista");
  }
  if (parametros.length > MAX_PARAMETERS) {
    throw new ValidationError(`Máximo de ${MAX_PARAMETERS} parâmetros permitidos`);
  }

  const seen = new Set();
  for (const param of parametros) {
    if (!param || typeof param !== "object" || Array.isArray(param)) {
      throw new ValidationError("Parâmetro inválido");
    }
    if (typeof param.nome !== "string" || !PARAM_NAME_REGEX.test(param.nome)) {
      throw new ValidationError("Nome de parâmetro inválido");
    }
    if (isReservedName(param.nome)) {
      throw new ValidationError(`Nome reservado não permitido como parâmetro: ${param.nome}`);
    }
    if (seen.has(param.nome)) {
      throw new ValidationError(`Parâmetro duplicado: ${param.nome}`);
    }
    seen.add(param.nome);
  }
  return seen;
}

function evalAst(node, env) {
  switch (node.type) {
    case "NumberLiteral":
    case "Constant":
      return node.value;

    case "Variable": {
      if (!env.has(node.name)) {
        throw new ValidationError(`Valor obrigatório não informado para o parâmetro: ${node.name}`);
      }
      return env.get(node.name);
    }

    case "UnaryOp": {
      const val = evalAst(node.operand, env);
      return node.op === "-" ? -val : +val;
    }

    case "BinaryOp": {
      const left = evalAst(node.left, env);
      const right = evalAst(node.right, env);

      if (node.op === "+") return left + right;
      if (node.op === "-") return left - right;
      if (node.op === "*") return left * right;
      if (node.op === "/") {
        if (right === 0) {
          throw new ValidationError("Divisão por zero ou operação indefinida");
        }
        const res = left / right;
        if (!Number.isFinite(res)) {
          throw new ValidationError("Divisão por zero ou operação indefinida");
        }
        return res;
      }
      if (node.op === "^") {
        return computePower(left, right);
      }
      throw new ValidationError(`Operador desconhecido: ${node.op}`);
    }

    case "FunctionCall": {
      const spec = ALLOWED_FUNCTIONS[node.name];
      const args = node.args.map((arg) => evalAst(arg, env));
      const res = spec.fn(args);
      if (Number.isNaN(res)) {
        throw new ValidationError("Resultado numérico inválido para os valores informados");
      }
      if (!Number.isFinite(res)) {
        throw new ValidationError("Divisão por zero ou operação indefinida");
      }
      return res;
    }

    default:
      throw new ValidationError("Nó de expressão inválido");
  }
}

function buildSubstitution(source, tokens, variableTokenIndices, env) {
  let out = "";
  let cursor = 0;

  for (let idx = 0; idx < tokens.length; idx++) {
    const token = tokens[idx];
    if (!variableTokenIndices.has(idx)) continue;

    out += source.slice(cursor, token.start);
    const val = env.get(token.value);
    out += val < 0 ? `(${val})` : String(val);
    cursor = token.end;
  }

  out += source.slice(cursor);
  return out;
}

class FormulaEvaluator {
  static parse(formula) {
    const { ast, variables } = parseInternal(formula);
    return { ast, variables };
  }

  static extractVariables(formula) {
    return parseInternal(formula).variables;
  }

  static validate(formula, parametros = []) {
    const { variables } = parseInternal(formula);
    const declaredNames = validateParametersList(parametros);

    for (const variable of variables) {
      if (!declaredNames.has(variable)) {
        throw new ValidationError(`Variável não declarada: ${variable}`);
      }
    }

    return {
      valida: true,
      variaveisDetectadas: variables,
    };
  }

  static evaluate(formula, parametros = [], valores = {}) {
    if (valores === null || typeof valores !== "object" || Array.isArray(valores)) {
      throw new ValidationError("Valores devem ser um objeto com pares parâmetro: número");
    }

    for (const key of Object.getOwnPropertyNames(valores)) {
      if (RESERVED_JS_NAMES.has(key)) {
        throw new ValidationError(`Chave reservada não permitida nos valores: ${key}`);
      }
    }

    const { source, tokens, ast, variables, variableTokenIndices } = parseInternal(formula);
    const declaredNames = validateParametersList(parametros);

    for (const variable of variables) {
      if (!declaredNames.has(variable)) {
        throw new ValidationError(`Variável não declarada: ${variable}`);
      }
    }

    const usedVarsSet = new Set(variables);
    const env = new Map();

    for (const param of parametros) {
      const name = param.nome;
      const isUsed = usedVarsSet.has(name);
      const isRequired = param.obrigatorio !== false || isUsed;
      const hasProvided = Object.prototype.hasOwnProperty.call(valores, name) && valores[name] !== undefined;

      if (!hasProvided) {
        if (isRequired) {
          throw new ValidationError(`Valor obrigatório não informado para o parâmetro: ${name}`);
        }
        continue;
      }

      const rawValue = valores[name];
      if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
        throw new ValidationError(`Valor inválido para o parâmetro '${name}': informe um número finito`);
      }

      env.set(name, rawValue);
    }

    const rawResult = evalAst(ast, env);
    if (Number.isNaN(rawResult)) {
      throw new ValidationError("Resultado numérico inválido para os valores informados");
    }
    if (!Number.isFinite(rawResult)) {
      throw new ValidationError("Divisão por zero ou operação indefinida");
    }

    const cleaned = Number(rawResult.toFixed(10));
    const resultado = Object.is(cleaned, -0) ? 0 : cleaned;

    const parametrosUsados = {};
    for (const variable of variables) {
      parametrosUsados[variable] = env.get(variable);
    }

    const substituicao = buildSubstitution(source, tokens, variableTokenIndices, env);

    return {
      resultado,
      resultadoFormatado: String(resultado),
      substituicao,
      parametrosUsados,
    };
  }
}

FormulaEvaluator.ALLOWED_FUNCTIONS = ALLOWED_FUNCTIONS;
FormulaEvaluator.ALLOWED_FUNCTION_NAMES = ALLOWED_FUNCTION_NAMES;
FormulaEvaluator.CONSTANTS = CONSTANTS;
FormulaEvaluator.RESERVED_JS_NAMES = RESERVED_JS_NAMES;
FormulaEvaluator.PARAM_NAME_REGEX = PARAM_NAME_REGEX;
FormulaEvaluator.MAX_PARAMETERS = MAX_PARAMETERS;
FormulaEvaluator.MAX_FORMULA_LENGTH = MAX_FORMULA_LENGTH;
FormulaEvaluator.MAX_TOKENS = MAX_TOKENS;
FormulaEvaluator.MAX_PAREN_DEPTH = MAX_PAREN_DEPTH;
FormulaEvaluator.isReservedName = isReservedName;
FormulaEvaluator.validateParametersList = validateParametersList;

module.exports = FormulaEvaluator;
