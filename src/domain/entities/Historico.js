/**
 * Modelo Historico - Histórico de Operações do Usuário
 * Antes: embarcado em User
 * Agora: collection separada para escalabilidade
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const HistoricoSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tipo: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    valores: {
      type: String,
      required: true,
    },
    resultado: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    criadoEm: {
      type: Date,
      default: Date.now,
      index: -1,
      expires: 7776000, // Auto-delete após 90 dias
    },
  },
  {
    collection: "historicos",
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Índices para queries rápidas
HistoricoSchema.index({ userId: 1, criadoEm: -1 });
HistoricoSchema.index({ userId: 1, tipo: 1 });

const Historico = mongoose.model("Historico", HistoricoSchema);
module.exports = Historico;
