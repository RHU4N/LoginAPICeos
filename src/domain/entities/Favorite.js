/**
 * Modelo Favorite - Favoritos do Usuário
 * Permite aos usuários favoritarem operações, funções, etc.
 */

const mongoose = require("mongoose");
const { Schema } = mongoose;

const FavoriteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ["custom-function", "calculation", "iot-device"],
      required: true,
    },
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    descricao: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    criadoEm: {
      type: Date,
      default: Date.now,
      index: -1,
    },
  },
  {
    collection: "favorites",
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Índices
FavoriteSchema.index({ userId: 1, criadoEm: -1 });
FavoriteSchema.index({ userId: 1, resourceType: 1 });
// Índice único para impedir duplicação
FavoriteSchema.index(
  { userId: 1, resourceId: 1, resourceType: 1 },
  { unique: true },
);

const Favorite = mongoose.model("Favorite", FavoriteSchema);
module.exports = Favorite;
