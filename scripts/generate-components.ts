import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const COMPONENTS_PATH = path.join(ROOT, 'src', 'generated', 'components.json');
const OUT_DIR = path.join(ROOT, 'src', 'generated');
const ENUMS_FILE = path.join(OUT_DIR, 'enums.ts');
const INTERFACES_FILE = path.join(OUT_DIR, 'components.ts');
const SCHEMAS_FILE = path.join(OUT_DIR, 'schemas.ts');

interface SchemaProperty {
  type?: string;
  enum?: string[];
  items?: SchemaProperty;
  anyOf?: SchemaProperty[];
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

interface Parameter {
  name: string;
  schema: SchemaProperty;
}

interface Component {
  name: string;
  module: string;
  type: string;
  executionModes: string[];
  inputs: {
    parameters: Parameter[];
  };
  outputs: {
    response: Parameter[];
  };
  configs: SchemaProperty;
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toPascalCase(str: string): string {
  return str
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');
}

function schemaToTsType(schema: SchemaProperty): string {
  if (!schema || !schema.type) return 'unknown';

  if (schema.enum) {
    return schema.enum.map((v) => `'${v}'`).join(' | ');
  }

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'bigint':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const props = Object.entries(schema.properties).map(([key, val]) => {
          const optional = !(schema.required || []).includes(key);
          return `${key}${optional ? '?' : ''}: ${schemaToTsType(val)}`;
        });
        return `{ ${props.join('; ')} }`;
      }
      return 'Record<string, unknown>';
    case 'array':
      if (schema.items) {
        if (schema.items.anyOf) {
          return `Array<${schema.items.anyOf.map((s) => schemaToTsType(s)).join(' | ')}>`;
        }
        if (schema.items.type) {
          const itemType = schemaToTsType(schema.items);
          const needsParens = itemType.includes(' | ');
          return needsParens ? `(${itemType})[]` : `${itemType}[]`;
        }
      }
      return 'unknown[]';
    default:
      return 'unknown';
  }
}

function schemaToZod(schema: SchemaProperty): string {
  if (!schema || !schema.type) return 'z.unknown()';

  if (schema.enum) {
    return `z.enum([${schema.enum.map((v) => `'${v}'`).join(', ')}])`;
  }

  switch (schema.type) {
    case 'string':
      return 'z.string()';
    case 'number':
    case 'bigint':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'object':
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const required = schema.required || [];
        const props = Object.entries(schema.properties).map(([key, val]) => {
          const zodType = schemaToZod(val);
          const isOptional = !required.includes(key);
          return `  ${key}: ${zodType}${isOptional ? '.optional()' : ''}`;
        });
        return `z.object({\n${props.join(',\n')},\n})`;
      }
      return 'z.record(z.string(), z.unknown())';
    case 'array':
      if (schema.items) {
        if (schema.items.anyOf) {
          const variants = schema.items.anyOf.map((s) => schemaToZod(s));
          return `z.array(z.union([${variants.join(', ')}]))`;
        }
        if (schema.items.type) {
          return `z.array(${schemaToZod(schema.items)})`;
        }
      }
      return 'z.array(z.unknown())';
    default:
      return 'z.unknown()';
  }
}

function generateInputSchema(component: Component): string {
  const name = toCamelCase(component.module);
  const params = component.inputs?.parameters || [];

  if (params.length === 0) {
    return `export const ${name}InputSchema = z.object({});`;
  }

  const fields = params.map((p) => {
    return `  ${p.name}: ${schemaToZod(p.schema)}`;
  });

  return [
    `export const ${name}InputSchema = z.object({`,
    fields.join(',\n') + ',',
    '});',
  ].join('\n');
}

function generateConfigSchema(component: Component): string {
  const name = toCamelCase(component.module);
  const props = component.configs?.properties || {};

  if (Object.keys(props).length === 0) {
    return `export const ${name}ConfigSchema = z.object({});`;
  }

  const required = component.configs?.required || [];
  const fields = Object.entries(props).map(([key, val]) => {
    const zodType = schemaToZod(val as SchemaProperty);
    const isOptional = !required.includes(key);
    return `  ${key}: ${zodType}${isOptional ? '.optional()' : ''}`;
  });

  return [
    `export const ${name}ConfigSchema = z.object({`,
    fields.join(',\n') + ',',
    '});',
  ].join('\n');
}

function generateOutputInterface(component: Component): string {
  const name = toPascalCase(component.module);
  const response = component.outputs?.response || [];

  if (response.length === 0) {
    return `export type ${name}Output = Record<string, never>;`;
  }

  const fields = response.map((r) => {
    return `  ${r.name}: ${schemaToTsType(r.schema)};`;
  });

  return [
    `export interface ${name}Output {`,
    ...fields,
    '}',
  ].join('\n');
}

function generate() {
  if (!fs.existsSync(COMPONENTS_PATH)) {
    console.error('components.json not found. Run fetch:components first.');
    process.exit(1);
  }

  const allComponents: Component[] = JSON.parse(fs.readFileSync(COMPONENTS_PATH, 'utf-8'));

  const executionModes = new Set<string>();
  const types = new Set<string>();
  const modules = new Set<string>();
  const componentModeComponents: Component[] = [];

  for (const c of allComponents) {
    (c.executionModes || []).forEach((m) => executionModes.add(m));

    const hasComponentMode = (c.executionModes || []).includes('COMPONENT');
    if (!hasComponentMode) continue;

    if (c.type) types.add(c.type);
    if (c.module) modules.add(c.module);
    componentModeComponents.push(c);
  }

  const sorted = componentModeComponents.sort((a, b) => a.module.localeCompare(b.module));

  // --- Generate enums file ---
  const enumLines = [
    '// This file is auto-generated by scripts/generate-components.ts',
    '// Do not edit manually.',
    '',
    'export enum ExecutionMode {',
    ...[...executionModes].sort().map((v) => `  ${v} = '${v}',`),
    '}',
    '',
    'export enum ComponentType {',
    ...[...types].sort().map((v) => `  ${v} = '${v}',`),
    '}',
    '',
    'export enum ComponentModule {',
    ...[...modules].sort().map((v) => `  ${v} = '${v}',`),
    '}',
    '',
  ];

  // --- Generate interfaces file ---
  const ifaceLines = [
    '// This file is auto-generated by scripts/generate-components.ts',
    '// Do not edit manually.',
    '',
    "import { z } from 'zod';",
    "import { ComponentModule } from './enums';",
    "import type { CallBuilder } from '../bootstrap/call-builder';",
  ];

  // Import all schemas
  const schemaImports: string[] = [];
  for (const c of sorted) {
    const name = toCamelCase(c.module);
    schemaImports.push(`${name}InputSchema`);
    schemaImports.push(`${name}ConfigSchema`);
  }
  ifaceLines.push(`import {`);
  ifaceLines.push(schemaImports.map((s) => `  ${s},`).join('\n'));
  ifaceLines.push(`} from './schemas';`);
  ifaceLines.push('');

  // Generate input/config types via z.infer, output interfaces manually
  for (const c of sorted) {
    const pascal = toPascalCase(c.module);
    const camel = toCamelCase(c.module);

    ifaceLines.push(`export type ${pascal}Input = z.infer<typeof ${camel}InputSchema>;`);
    ifaceLines.push('');
    ifaceLines.push(generateOutputInterface(c));
    ifaceLines.push('');
    ifaceLines.push(`export type ${pascal}Config = z.infer<typeof ${camel}ConfigSchema>;`);
    ifaceLines.push('');
  }

  // Generate call signature map
  ifaceLines.push('export interface CallSignatureMap {');
  for (const c of sorted) {
    const name = toPascalCase(c.module);
    ifaceLines.push(`  [ComponentModule.${c.module}]: { input: ${name}Input; output: ${name}Output; config: ${name}Config };`);
  }
  ifaceLines.push('}');
  ifaceLines.push('');

  // Generate callable interface using generic
  ifaceLines.push('export interface CallableComponents {');
  ifaceLines.push('  call<M extends ComponentModule>(');
  ifaceLines.push('    module: M,');
  ifaceLines.push('    ...args: CallSignatureMap[M]["input"] extends Record<string, never>');
  ifaceLines.push('      ? CallSignatureMap[M]["config"] extends Record<string, never>');
  ifaceLines.push('        ? [input?: CallSignatureMap[M]["input"], config?: CallSignatureMap[M]["config"]]');
  ifaceLines.push('        : [input: CallSignatureMap[M]["input"], config: CallSignatureMap[M]["config"]]');
  ifaceLines.push('      : CallSignatureMap[M]["config"] extends Record<string, never>');
  ifaceLines.push('        ? [input: CallSignatureMap[M]["input"], config?: CallSignatureMap[M]["config"]]');
  ifaceLines.push('        : [input: CallSignatureMap[M]["input"], config: CallSignatureMap[M]["config"]]');
  ifaceLines.push('  ): CallBuilder<CallSignatureMap[M]["output"]>;');
  ifaceLines.push('}');
  ifaceLines.push('');

  // --- Generate schemas file ---
  const schemaLines = [
    '// This file is auto-generated by scripts/generate-components.ts',
    '// Do not edit manually.',
    '',
    "import { z } from 'zod';",
    "import { ComponentModule } from './enums';",
    '',
  ];

  for (const c of sorted) {
    schemaLines.push(generateInputSchema(c));
    schemaLines.push('');
    schemaLines.push(generateConfigSchema(c));
    schemaLines.push('');
  }

  // Generate validation map
  schemaLines.push('export const validationSchemas: Record<ComponentModule, { input: z.ZodType; config: z.ZodType }> = {');
  for (const c of sorted) {
    const name = toCamelCase(c.module);
    schemaLines.push(`  [ComponentModule.${c.module}]: { input: ${name}InputSchema, config: ${name}ConfigSchema },`);
  }
  schemaLines.push('};');
  schemaLines.push('');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(ENUMS_FILE, enumLines.join('\n'), 'utf-8');
  fs.writeFileSync(INTERFACES_FILE, ifaceLines.join('\n'), 'utf-8');
  fs.writeFileSync(SCHEMAS_FILE, schemaLines.join('\n'), 'utf-8');

  console.log(`Generated ${path.relative(ROOT, ENUMS_FILE)} (${executionModes.size} execution modes, ${types.size} types, ${modules.size} modules)`);
  console.log(`Generated ${path.relative(ROOT, INTERFACES_FILE)} (${sorted.length} component interfaces)`);
  console.log(`Generated ${path.relative(ROOT, SCHEMAS_FILE)} (${sorted.length} validation schemas)`);
}

generate();
