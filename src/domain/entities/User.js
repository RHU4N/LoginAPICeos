/**
 * Modelo User - Entidade de Usuário
 * Refatorado com índices, validações e estrutura melhorada
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    // Dados básicos
    nome: {
      type: String,
      required: [true, "Nome é obrigatório"],
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email é obrigatório"],
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Email inválido"],
      unique: true,
      sparse: true,
      index: true,
    },
    senhaHash: {
      type: String,
      required: [true, "Senha é obrigatória"],
      minlength: 60,
      select: false,
    },
    telefone: {
      type: String,
      trim: true,
    },

    // Status
    assinante: {
      type: Boolean,
      default: false,
    },
    ativo: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
      select: false,
    },

    // Dados de segurança
    tentativasLogin: {
      type: Number,
      default: 0,
      select: false,
    },
    bloqueadoAte: {
      type: Date,
      select: false,
    },
    ultimoLogin: {
      type: Date,
    },
    // Incrementado ao fazer logout ou trocar senha: invalida todos os refresh tokens.
    tokenVersion: { type: Number, default: 0, select: false },

    // Contadores
    countFavoritos: {
      type: Number,
      default: 0,
    },
    countFuncoesPersonalizadas: {
      type: Number,
      default: 0,
    },

    // Timestamps
    criadoEm: {
      type: Date,
      default: Date.now,
    },
    atualizadoEm: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "users",
    timestamps: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.senhaHash;
        delete ret.tentativasLogin;
        delete ret.bloqueadoAte;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Índices
UserSchema.index({ email: 1, ativo: 1 });
UserSchema.index({ criadoEm: -1 });

// Pre-save middleware
UserSchema.pre("save", function (next) {
  this.atualizadoEm = new Date();
  next();
});

UserSchema.pre("findByIdAndUpdate", function (next) {
  this.set({ atualizadoEm: new Date() });
  next();
});

// Métodos
UserSchema.methods.isBlocked = function () {
  return this.bloqueadoAte && this.bloqueadoAte > new Date();
};

UserSchema.methods.resetLoginAttempts = function () {
  this.tentativasLogin = 0;
  this.bloqueadoAte = undefined;
};

UserSchema.methods.incrementLoginAttempts = function () {
  this.tentativasLogin = (this.tentativasLogin || 0) + 1;
};

UserSchema.methods.blockUser = function (durationMs) {
  this.bloqueadoAte = new Date(Date.now() + durationMs);
};

const User = mongoose.model("User", UserSchema);
module.exports = User;
