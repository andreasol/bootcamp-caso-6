// Help copy shared by the "?" popup, the tutorial and the FAQ, so the three never disagree.
// Plain Spanish, specific to this product. Facts here mirror docs/design.md and the database
// rules: if a rule changes there, change it here too.
import type { DiscrepancyType } from "@/lib/domain/types";
import type { AppRole } from "@/services/profile";

export const TYPE_GLOSSARY: Record<DiscrepancyType, { means: string; action: string }> = {
  amount_mismatch: {
    means: "Un monto de pago no es igual en el sistema local y en el global, y la diferencia supera el umbral.",
    action: "Revisa cuál de los dos tiene el valor correcto y corrige el que esté mal.",
  },
  leave_balance_mismatch: {
    means: "El saldo de vacaciones de una persona no coincide entre ambos sistemas.",
    action: "Revisa los movimientos de vacaciones del período; a veces es un día sin sincronizar.",
  },
  missing_in_global: {
    means: "El pago o el saldo existe en el sistema local, pero no hay registro en el global.",
    action: "Verifica si falta dar de alta a la persona en el global o si el registro llegó tarde.",
  },
  missing_in_local: {
    means: "El registro existe en el global, pero el país no lo informó en su archivo.",
    action: "Pide al país que confirme si fue una baja que no informó o un olvido.",
  },
  missing_file: {
    means: "Un archivo que debía llegar este mes no llegó. Mientras falte, no se pueden comparar sus registros.",
    action: "Pide el archivo al país o al proveedor de su sistema.",
  },
};

export interface TutorialStep {
  title: string;
  body: string;
  tip?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Entra y mira de quién eres",
    body: "Arriba a la derecha aparece tu nombre, tu rol y tu alcance (por ejemplo, «Analista · Chile»). Todo lo que ves en la herramienta sale de ahí: no verás datos de otros países o regiones.",
    tip: "Si ves «Tu cuenta todavía no tiene un rol asignado», elige un rol en esa misma pantalla o pide al administrador que te lo asigne.",
  },
  {
    title: "Lee el resumen del cierre",
    body: "Arriba de la cola hay 4 cifras: cuántas diferencias están pendientes, cuántas son de prioridad alta, cuántas están escaladas y cuántas ya se resolvieron. Debajo, barras por prioridad, por tipo y por país.",
    tip: "«Pendientes» son las abiertas más las escaladas. Los porcentajes dicen sobre cuántas se calculan.",
  },
  {
    title: "Filtra la lista",
    body: "Elige país, tipo de diferencia y estado, y pulsa «Aplicar filtros». Por defecto ves las pendientes. «Limpiar» vuelve a la vista completa.",
  },
  {
    title: "Abre una diferencia",
    body: "Pulsa el nombre de la persona o del archivo. Verás el valor local, el global, la varianza, el umbral aplicado y los registros de origen con su ID, para que puedas ir a buscarlos a cada sistema.",
    tip: "Las cifras las calcula el sistema con reglas fijas. Nunca las calcula la IA.",
  },
  {
    title: "Pide ayuda a la IA (opcional)",
    body: "En la cola, pulsa «Priorizar con IA». Tarda entre 30 y 40 segundos. Después cada fila muestra si su prioridad viene de la IA o de las reglas, y en el detalle aparece una explicación, una acción sugerida y qué tan segura está la IA.",
    tip: "Si la IA falla o responde algo inválido, la lista sigue ordenada por reglas y la pantalla te lo avisa.",
  },
  {
    title: "Toma tu decisión",
    body: "En el detalle, escribe un comentario y elige: «Aprobar la diferencia» si es correcta o aceptable, «Marcar como corregida» si ya la arreglaste en el sistema que estaba mal, o «Escalar» si necesita a otra persona. Corregir y escalar exigen comentario.",
    tip: "Una diferencia aprobada o corregida queda cerrada. Una escalada sigue pendiente hasta que alguien la cierre.",
  },
];

export interface FaqItem {
  id: string;
  q: string;
  // each string is one paragraph
  a: string[];
}

export interface FaqGroup {
  title: string;
  items: FaqItem[];
}

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "Uso diario",
    items: [
      {
        id: "que-resuelve",
        q: "¿Qué problema resuelve esta herramienta?",
        a: [
          "Cada mes, quien lleva la planilla de un país compara a mano su sistema local con los sistemas globales de pago y vacaciones. Eso toma horas y no deja claro qué atender primero antes del cierre de pago.",
          "La herramienta hace esa comparación sola, encuentra lo que no cuadra y lo ordena por urgencia. Tú revisas y decides.",
        ],
      },
      {
        id: "tipos",
        q: "¿Qué tipos de diferencia existen?",
        a: [
          "Hay cinco: monto distinto, saldo de vacaciones distinto, falta en el sistema global, falta en el sistema local y archivo no recibido. En el Tutorial hay una tabla que explica qué significa cada una y qué hacer.",
        ],
      },
      {
        id: "umbral",
        q: "¿Qué es el umbral?",
        a: [
          "Es la diferencia mínima que se considera un problema. Una diferencia cuenta si supera el umbral en valor absoluto o en porcentaje. Así los centavos de redondeo no llenan tu lista.",
        ],
      },
      {
        id: "prioridad-reglas",
        q: "¿Cómo se decide la prioridad por reglas?",
        a: [
          "Alta: falta un archivo, hay un pago local sin registro global, o la varianza es 3 veces el umbral o más.",
          "Media: monto distinto por debajo de 3 veces el umbral, registro que falta en el sistema local, o saldo de vacaciones local sin registro global.",
          "Baja: saldo de vacaciones distinto por debajo de 3 veces el umbral, porque no bloquea el pago.",
        ],
      },
      {
        id: "corregir-escalar",
        q: "¿Cuál es la diferencia entre aprobar, corregir y escalar?",
        a: [
          "Aprobar: revisaste y la diferencia es aceptable o correcta. Corregir: ya la arreglaste en el sistema que estaba mal. Escalar: necesita a otra persona o más información.",
          "Corregir y escalar piden un comentario, para que quede claro qué hiciste o qué falta.",
        ],
      },
      {
        id: "deshacer",
        q: "¿Puedo deshacer una decisión?",
        a: [
          "Una diferencia aprobada o corregida queda cerrada y ya no admite cambios. Una escalada sigue abierta a decisión: puedes aprobarla o corregirla después. Todas las decisiones quedan en el historial del detalle.",
        ],
      },
    ],
  },
  {
    title: "La inteligencia artificial",
    items: [
      {
        id: "que-hace-ia",
        q: "¿Qué hace la IA y qué no hace?",
        a: [
          "La IA propone un orden de prioridad, explica la causa más probable en palabras sencillas y sugiere una acción. Nada más.",
          "No calcula montos ni varianzas, no decide quién ve qué y no puede aprobar, corregir ni escalar. Eso lo hacen reglas fijas del sistema y personas.",
        ],
      },
      {
        id: "ia-datos",
        q: "¿Qué datos recibe la IA?",
        a: [
          "Solo las diferencias que tú ya tienes permiso de ver, y solo lo necesario: tipo, concepto, país, montos, varianza y umbral. No recibe nombres de personas: a cada empleado se le pone un alias como E1 o E2 solo para esa consulta.",
          "Además, todos los datos de este proyecto son ficticios.",
        ],
      },
      {
        id: "ia-falla",
        q: "¿Qué pasa si la IA falla o se equivoca?",
        a: [
          "Si no responde a tiempo, responde en un formato inválido o cita un registro que no le enviamos, el sistema descarta toda su respuesta y deja la lista con el orden por reglas. La pantalla te avisa con el motivo.",
          "Aun cuando responda bien, es una sugerencia: la decisión es tuya.",
        ],
      },
      {
        id: "ia-reglas",
        q: "¿Qué significa «IA» y «Reglas» en cada fila?",
        a: [
          "Indica de dónde viene la prioridad que ves. «IA» es la sugerida por el modelo; «Reglas» es la calculada por las reglas fijas. Si difieren, verás las dos: por ejemplo «IA · reglas: alta».",
        ],
      },
      {
        id: "ia-tarda",
        q: "¿Por qué «Priorizar con IA» tarda tanto?",
        a: [
          "El modelo analiza todos los casos abiertos de tu alcance y suele tardar entre 30 y 40 segundos. Mientras tanto la lista sigue disponible, ordenada por reglas.",
        ],
      },
    ],
  },
  {
    title: "Seguridad y datos",
    items: [
      {
        id: "por-que-no-veo",
        q: "¿Por qué no veo los datos de otro país?",
        a: [
          "Porque la base de datos filtra el acceso antes de mostrar cualquier registro, según tu rol. Un analista ve su país, un líder regional su región y un gerente global todos los países. Eso no depende de la pantalla ni de la IA.",
          "Si cambias la dirección a mano para pedir otro país, la respuesta sale vacía y el intento queda registrado.",
        ],
      },
      {
        id: "registro",
        q: "¿Mis acciones quedan registradas?",
        a: [
          "Sí. Cada ingreso, cada consulta a la cola, cada decisión y cada llamada a la IA queda en un registro de auditoría que nadie puede editar ni borrar, incluidos los intentos que fueron bloqueados.",
        ],
      },
      {
        id: "cuarentena",
        q: "¿Qué es la cuarentena?",
        a: [
          "Si un dato no se puede traducir con certeza (por ejemplo, un código de empleado sin equivalencia o una fecha en otro formato), no se mezcla con los demás: queda aparte y solo lo ve el administrador.",
        ],
      },
      {
        id: "datos-reales",
        q: "¿Son datos reales?",
        a: [
          "No. Las personas, los montos, los IDs y la empresa «Grupo Altamar» son inventados. Los países son reales para que los ejemplos se entiendan.",
        ],
      },
    ],
  },
  {
    title: "Cuentas y roles",
    items: [
      {
        id: "sin-rol",
        q: "¿Por qué mi cuenta no ve nada?",
        a: [
          "Una cuenta nueva nace sin rol y no ve ningún dato hasta tener uno. En el modo de revisión puedes elegir tu rol en la pantalla de registro o en el aviso que aparece en la cola. Si ese modo está apagado, pide al administrador que te lo asigne.",
        ],
      },
      {
        id: "roles",
        q: "¿Qué roles existen?",
        a: [
          "Analista (un país), líder regional (una región), gerente global (todos los países) y administrador (todos los países y gestión de cuentas). El rol de administrador no se puede elegir uno mismo.",
        ],
      },
    ],
  },
];

export const ROLE_TABLE: { role: AppRole; label: string; sees: string; can: string }[] = [
  { role: "analyst", label: "Analista", sees: "Solo su país", can: "Revisar y decidir sobre los casos de su país" },
  { role: "regional_lead", label: "Líder regional", sees: "Los países de su región", can: "Revisar y decidir sobre los casos de su región" },
  { role: "global_manager", label: "Gerente global", sees: "Todos los países", can: "Revisar y decidir sobre cualquier caso" },
  {
    role: "admin",
    label: "Administrador",
    sees: "Todos los países",
    can: "Lo mismo que el gerente global, más asignar o quitar roles en «Usuarios»",
  },
];

// Short line for the popup, by role.
export const ROLE_SEES: Record<AppRole, string> = {
  analyst: "solo los casos de tu país",
  regional_lead: "los casos de los países de tu región",
  global_manager: "los casos de todos los países",
  admin: "los casos de todos los países",
};
