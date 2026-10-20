import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Definición de la jerarquía completa de categorías y entidades de la UC
  const estructuraUC = [
    {
      categoria: "RECTORÍA",
      entidades: [
        "DIRECCIÓN DE CAPELLANÍA",
        "DIRECCIÓN DE DEPORTE CENTRAL",
        "DIRECCIÓN DE DESARROLLO ESTUDIANTIL CENTRAL",
        "DIRECCIÓN DE MANTENIMIENTO CENTRAL",
        "DIRECCIÓN DE RECURSOS HUMANOS CENTRAL",
        "DIRECCIÓN DE RELACIONES INTERINSTITUCIONALES",
        "COMISIONADURÍA DEL RECTOR NÚCLEO ARAGUA",
        "COMISIONADURÍA DEL RECTOR NÚCLEO PUERTO CABELLO",
        "COMISIONADURÍA DEL RECTOR NÚCLEO COJEDES",
        "CONSULTORÍA JURÍDICA",
        "DIRECCIÓN DE CULTURA CENTRAL",
        "DIRECCIÓN DE MEDIOS Y PUBLICACIONES",
        "DIRECCIÓN DE TECNOLOGÍA AVANZADA (DTA)",
        "DIRECCIÓN DE TRANSPORTE CENTRAL",
        "DIRECCIÓN DE EXTENSIÓN Y SERVICIOS A LA COMUNIDAD",
      ],
    },
    {
      categoria: "VICERRECTORÍA ACADÉMICA",
      entidades: [
        "CENTRO DE INVESTIGACIONES EROGOLÓGICAS DE LA UC (CIERUC)",
        "DIRECCIÓN GENERAL DE ASUNTOS PROFESORALES",
        "DIRECCIÓN DE BIBLIOTECA CENTRAL",
        "UNIDAD DE INVESTIGACIÓN Y DESARROLLO CURRICULAR",
      ],
    },
    {
      categoria: "VICERRECTORÍA ADMINISTRATIVA",
      entidades: [
        "DIRECCIÓN DE ADMINISTRACIÓN",
        "DIRECCIÓN DE INFORMÁTICA",
        "DIRECCIÓN DEL PLAN DE HOSPITALIZACIÓN, CIRUGÍA Y MATERNIDAD",
        "DIRECCIÓN DE PLANIFICACIÓN Y PROGRAMACIÓN PRESUPUESTARIA",
        "DIRECCIÓN DE PREVENCIÓN DE INCENDIOS, PROTECCIÓN Y SEGURIDAD",
      ],
    },
    {
      categoria: "SECRETARIA",
      entidades: [
        "CENTRO DE APOYO UNIVERSITARIO A LA COMUNIDAD (CAUCE)",
        "CENTRO DE ESTIMULACIÓN INTEGRAL",
        "DIRECCION DE DOCUMENTACIÓN E INFORMACIÓN",
        "DIRECCIÓN DE LA SECRETARÍA DEL CONSEJO UNIVERSITARIO",
        "OFICINA DEL CRONISTA",
      ],
    },
    {
      categoria: "FACULTADES",
      entidades: [
        "FACULTAD INGENIERÍA",
        "FACULTAD CIENCIAS DE LA SALUD",
        "FACULTAD CIENCIAS DE LA SALUD – NUCLEO ARAGUA",
        "FACULTAD CIENCIAS JURÍDICAS Y POLÍTICAS",
        "FACULTAD CIENCIAS ECONÓMICAS Y SOCIALES (FACES)",
        "FACULTAD CIENCIAS ECONÓMICAS Y SOCIALES (FACES) – NUCLEO ARAGUA",
        "FACULTAD CIENCIAS DE LA EDUCACIÓN (FACE)",
        "FACULTAD ODONTOLOGÍA",
        "FACULTAD EXPERIMENTAL DE CIENCIA Y TECNOLOGÍA (FACYT)",
      ],
    },
    {
      categoria: "CONSEJOS Y COMISIONES",
      entidades: [
        "CONSEJO UNIVERSITARIO",
        "COMISIÓN DELEGADA",
        "COMISIÓN ELECTORAL UNIVERSITARIA",
        "COMISIÓN DE AUDITORÍA ACADÉMICA",
        "COMISIÓN DE EVALUACIÓN INSTITUCIONAL",
        "COMISIÓN PLAN ADMINISTRADO DE HOSPITALIZACIÓN, CIRUGÍA Y MATERNIDAD",
        "COMISIÓN ASESORA DE RECURSOS HUMANOS",
      ],
    },
    {
      categoria: "INDEPENDIENTES",
      entidades: [
        "CONSEJO DE APELACIONES",
        "CONSEJO DE FOMENTO",
        "DIRECCIÓN GENERAL DE ASUNTOS ESTUDIANTILES",
        "DIRECCIÓN DE MEDIOS ELECTRÓNICOS Y TELEMÁTICA",
        "DIRECCIÓN GENERAL DE POSTGRADO",
        "UNIDAD DE ATENCIÓN MÉDICA INTEGRAL (UAMI)",
        "UNIDAD DE ALTERACIONES DE CRECIMIENTO Y DESARROLLO CRANEOFACIALES (UDACYDC)",
        "UNIDAD EDUCATIVA INSTITUTO EXPERIMENTAL EDUCATIVO \"SIMÓN BOLÍVAR\" IEBS-APUCITO",
        "UNIDAD EDUCATIVA UNIVERSIDAD DE CARABOBO \"FÉLIX LEONTE OLIVO\"",
        "GUARDERÍA \"MIGUEL CENTENO\"",
        "OFICINA DE ATENCIÓN AL CIUDADANO",
        "OFICINA CENTRAL DE PROTOCOLO Y CEREMONIAL",
        "CENTRO DE ESTUDIOS SOBRE EL PROBLEMA DE LAS DROGAS (CEPRODUC)",
        "DIRECCIÓN DE AUDITORÍA INTERNA",
      ],
    },
    {
      categoria: "DEPARTAMENTOS Y UNIDADES DE LA DIRECCIÓN CENTRAL DE RRHH",
      entidades: [
        "UNIDAD DE REGISTRO E INFORMACIÓN",
        "DPTO. ASESORÍA LEGAL",
        "OFICINA SECTORIAL DE ADMINISTRACION Y SERVICIOS",
        "DPTO. PLANIFICACIÓN Y CONTROL",
        "DESPACHO",
        "DPTO. BENEFICIOS CONTRACTUALES",
        "DPTO. GESTIÓN DOCENTE",
        "DPTO. GESTION DE ADMINISTRATIVO Y OBRERO",
        "DPTO. PRESTACIONES SOCIALES",
        "DPTO. GESTION Y DESARROLLO DEL TALENTO HUMANO",
        "OFICINA SECTORIAL DE RRHH DE RECTORÍA",
      ],
    },
  ];

  // 2. Departamento por defecto
  const deptoExiste = await prisma.departamentos.findFirst({
    where: { nombre: "Recursos Humanos" },
  });

  if (!deptoExiste) {
    await prisma.departamentos.create({
      data: {
        nombre: "Recursos Humanos",
        descripcion: "Departamento principal de RRHH",
      },
    });
  }

  // 3. Cargar Categorías y Entidades Origen/Destino
  for (const grupo of estructuraUC) {
    let cat = await prisma.categorias.findFirst({
      where: { nombre: grupo.categoria },
    });

    if (!cat) {
      cat = await prisma.categorias.create({
        data: { nombre: grupo.categoria },
      });
    }

    for (const nombreEntidad of grupo.entidades) {
      const existeEntidad = await prisma.origenDestino.findFirst({
        where: { nombre: nombreEntidad },
      });

      if (!existeEntidad) {
        await prisma.origenDestino.create({
          data: {
            nombre: nombreEntidad,
            categoria_id: cat.id,
          },
        });
      }
    }
  }

}

main()
  .catch((e) => {
    console.error("Error al ejecutar el seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });