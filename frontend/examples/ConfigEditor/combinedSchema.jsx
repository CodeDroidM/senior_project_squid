// src/ConfigEditor/combinedSchema.js
import { sharedSchema, loadSchema, importSchema } from "./schemas";

export const combinedSchema = {
  type: "object",
  properties: {
    SharedConfiguration: sharedSchema,
    LoadConfiguration: loadSchema,
    ImportConfiguration: importSchema,
  },
  required: ["SharedConfiguration", "LoadConfiguration", "ImportConfiguration"],
};
