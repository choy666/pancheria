import dotenv from 'dotenv';

// Mismo patrón que scripts/cargar-catalogo.ts y src/db/seeds.ts: dotenv corre
// antes del primer uso de la base (el cliente se resuelve lazy en @/db). Las
// variables ya exportadas en el proceso tienen precedencia sobre el archivo.
dotenv.config({ path: '.env.local' });

import { pathToFileURL } from 'url';
import bcrypt from 'bcrypt';
import * as branchRepository from '@/repositories/branchRepository';
import * as userRepository from '@/repositories/userRepository';
import * as branchService from '@/application/services/branchService';
import { BCRYPT_HASH_COST } from '@/config/auth';
import type { BranchOpeningHours } from '@/domain/types';

// ————————————————————————————————————————————————————————————————————
// Entrada (todas por variables de entorno)
// ————————————————————————————————————————————————————————————————————

type SucursalInput = {
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  ubicacion: string | null;
  horarios: BranchOpeningHours[];
  redes: unknown;
  usuario: string | null;
  password: string | null;
};

function parseHorarios(raw: string | undefined): BranchOpeningHours[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      'SUCURSAL_HORARIOS no es un JSON válido. Formato: [{"dayOfWeek":0,"open":"19:30","close":"03:00"}, ...] (dayOfWeek 0=domingo … 6=sábado; un cierre menor que la apertura es un turno overnight).'
    );
  }
  // La validación de dominio (formato HH:mm, solapamientos, overnight) la hace
  // branchService.createBranch vía validateOpeningHours.
  return parsed as BranchOpeningHours[];
}

function readInput(): SucursalInput {
  return {
    nombre: process.env.SUCURSAL_NOMBRE?.trim() ?? '',
    direccion: process.env.SUCURSAL_DIRECCION?.trim() || null,
    telefono: process.env.SUCURSAL_TELEFONO?.trim() || null,
    ubicacion: process.env.SUCURSAL_UBICACION?.trim() || null,
    horarios: parseHorarios(process.env.SUCURSAL_HORARIOS),
    redes: process.env.SUCURSAL_REDES?.trim()
      ? JSON.parse(process.env.SUCURSAL_REDES)
      : [],
    usuario: process.env.SUCURSAL_USUARIO?.trim() || null,
    password: process.env.SUCURSAL_PASSWORD ?? null,
  };
}

// ————————————————————————————————————————————————————————————————————
// CLI
// ————————————————————————————————————————————————————————————————————

function printUsage(): void {
  console.log(`Crea una sucursal con su usuario operador (alta de sucursal nueva).

Uso:
  SUCURSAL_NOMBRE="..." npx tsx scripts/crear-sucursal.ts [--apply]

Variables:
  SUCURSAL_NOMBRE      (requerida) nombre exacto de la sucursal.
  SUCURSAL_DIRECCION   dirección de la ficha.
  SUCURSAL_TELEFONO    se guarda como contacto "Principal".
  SUCURSAL_UBICACION   URL o coordenadas del mapa.
  SUCURSAL_HORARIOS    JSON [{"dayOfWeek":0,"open":"19:30","close":"03:00"},...]
  SUCURSAL_REDES       JSON [{"network":"instagram","url":"..."}]
  SUCURSAL_USUARIO     usuario operador a crear (requiere SUCURSAL_PASSWORD).
  SUCURSAL_PASSWORD    contraseña del operador (mínimo 6 caracteres).

Sin --apply solo imprime el plan (dry-run). Si la sucursal ya existe no la
recrea: informa y continúa solo con el usuario si corresponde.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  const apply = args.includes('--apply');

  const input = readInput();
  if (!input.nombre) {
    console.error('Falta SUCURSAL_NOMBRE. Ver --help.');
    process.exit(1);
  }
  if ((input.usuario && !input.password) || (!input.usuario && input.password)) {
    console.error(
      'SUCURSAL_USUARIO y SUCURSAL_PASSWORD deben definirse juntas.'
    );
    process.exit(1);
  }

  console.log('\nPlan de alta:');
  console.log(`  Sucursal: ${input.nombre}`);
  console.log(`  Dirección: ${input.direccion ?? '(sin datos)'}`);
  console.log(`  Teléfono: ${input.telefono ?? '(sin datos)'}`);
  console.log(
    `  Horarios: ${input.horarios.length > 0 ? `${input.horarios.length} franjas` : '(sin horarios — abierta siempre que haya caja abierta)'}`
  );
  console.log(`  Operador: ${input.usuario ?? '(sin usuario)'}`);

  if (!apply) {
    console.log('\nDry-run: no se escribió nada. Re-ejecutar con --apply.');
    process.exit(0);
  }

  const existing = await branchRepository.findByNameCaseInsensitive(
    input.nombre
  );
  const branch = existing
    ? existing
    : await branchService.createBranch({
        name: input.nombre,
        openingHours: input.horarios,
        address: input.direccion,
        phones: input.telefono
          ? [{ label: 'Principal', number: input.telefono }]
          : [],
        socialLinks: input.redes,
        location: input.ubicacion,
      });

  console.log(
    existing
      ? `\nLa sucursal "${branch.name}" ya existía (id ${branch.id}); se reutiliza.`
      : `\nSucursal "${branch.name}" creada (id ${branch.id}).`
  );

  if (input.usuario && input.password) {
    const existingUser = await userRepository.findByUsername(input.usuario);
    if (existingUser) {
      console.log(
        `El usuario "${input.usuario}" ya existía (id ${existingUser.id}); no se tocó la contraseña.`
      );
    } else {
      if (input.password.length < 6) {
        throw new Error('SUCURSAL_PASSWORD debe tener al menos 6 caracteres.');
      }
      // userService.createUser no sirve acá: valida la sucursal vía
      // branchService.getBranchById, que usa unstable_cache y solo existe
      // dentro del runtime de Next. Mismo patrón que src/db/seeds.ts:
      // bcrypt + insert directo.
      const passwordHash = await bcrypt.hash(
        input.password,
        BCRYPT_HASH_COST
      );
      const user = await userRepository.insert({
        username: input.usuario,
        passwordHash,
        role: 'operator',
        branchId: branch.id,
      });
      if (!user) {
        throw new Error('No se pudo crear el usuario operador.');
      }
      console.log(`Usuario operador "${user.username}" creado (id ${user.id}).`);
    }
  }

  console.log(
    '\nNota: las escrituras directas no invalidan el caché de sucursales. Esperar DATA_CACHE_REVALIDATE_S o hacer redeploy antes de verificar.'
  );
  process.exit(0);
}

const isMain =
  process.argv.length > 1 &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((error) => {
    console.error('Error al crear la sucursal:', error);
    process.exit(1);
  });
}
