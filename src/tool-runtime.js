import fs from 'node:fs';
import { z } from 'zod';
import { fileExistsArg } from './generator.js';

function primitiveSchema(arg) {
  switch (arg.type) {
    case 'integer':
      return z.number().int();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(z.any());
    case 'object':
      return z.record(z.any());
    case 'string':
      return z.string();
    case 'mixed':
    default:
      return z.any();
  }
}

function decorateSchema(arg, schema) {
  let current = schema;
  if (arg.enum?.length) current = z.enum([...arg.enum]);
  if (arg.type === 'string' && arg.minLength) current = current.min(arg.minLength);
  if ((arg.type === 'integer' || arg.type === 'number') && typeof arg.minimum === 'number') current = current.min(arg.minimum);
  if ((arg.type === 'integer' || arg.type === 'number') && typeof arg.maximum === 'number') current = current.max(arg.maximum);
  return arg.required ? current : current.optional();
}

export function buildOperationInputSchema(operation) {
  const shape = {};
  for (const arg of operation.args) {
    shape[arg.name] = decorateSchema(arg, primitiveSchema(arg));
  }
  if (operation.mutation) {
    shape.confirm = z.boolean().optional();
  }
  return shape;
}

export function validateSpecialOperationArgs(operation, args) {
  const fileArg = fileExistsArg(operation);
  if (!fileArg) return;
  const filePath = args[fileArg.name];
  if (!filePath || typeof filePath !== 'string') {
    throw {
      kind: 'validation_error',
      message: `${fileArg.name} is required for ${operation.toolName}.`,
      details: { argument: fileArg.name, toolName: operation.toolName }
    };
  }
  if (!fs.existsSync(filePath)) {
    throw {
      kind: 'validation_error',
      message: `File not found: ${filePath}`,
      details: { argument: fileArg.name, filePath, toolName: operation.toolName }
    };
  }
}

export function enforceMutationConfirmation(operation, config, args) {
  if (!operation.mutation || !config.safeMode) return;
  if (args.confirm === true) return;
  throw {
    kind: 'confirmation_required',
    message: `${operation.toolName} is a mutating operation and requires confirm=true while safe mode is enabled.`,
    details: {
      toolName: operation.toolName,
      method: operation.method,
      route: operation.route
    }
  };
}
