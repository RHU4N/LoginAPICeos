/**
 * Modelo CustomFunction - Funções Personalizadas do Usuário
 * Permite aos usuários criar e salvar cálculos/operações personalizadas
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const CustomFunctionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    nome: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    descricao: {
      type: String,
      trim: true,
    },
    categoria: {
      type: String,
      enum: ["matematica", "fisica", "quimica", "financeira", "outro"],
      required: true,
      index: true,
    },
    tipo: {
      type: String,
      required: true,
      trim: true,
      // Ex: 'variacao', 'juros-simples', etc.
    },
    parametros: [
      {
        nome: String,
        tipo: String, // number, string, etc.
        descricao: String,
        obrigatorio: Boolean,
      },
    ],
    formula: {
      type: String,
      required: true,
      // Descrição legível da fórmula
    },
    expressao: {
      type: String,
      // Expressão compilável (futuramente)
    },
    resultadoExemplo: {
      type: mongoose.Schema.Types.Mixed,
    },
    tags: [String],
    favoritos: {
      type: Number,
      default: 0,
    },
    usos: {
      type: Number,
      default: 0,
    },
    publica: {
      type: Boolean,
      default: false,
      index: true,
    },
    criadoEm: {
      type: Date,
      default: Date.now,
      index: -1,
    },
    atualizadoEm: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "custom-functions",
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Índices
CustomFunctionSchema.index({ userId: 1, criadoEm: -1 });
CustomFunctionSchema.index({ userId: 1, categoria: 1 });
CustomFunctionSchema.index({ publica: 1, favoritos: -1 });

// Pre-save middleware
CustomFunctionSchema.pre("save", function (next) {
  this.atualizadoEm = new Date();
  next();
});

CustomFunctionSchema.pre("findByIdAndUpdate", function (next) {
  this.set({ atualizadoEm: new Date() });
  next();
});

const CustomFunction = mongoose.model("CustomFunction", CustomFunctionSchema);
module.exports = CustomFunction;
