/**
 * Avisos de baja calidad para quien busca un trabajo: proyectos masivos de transcripción, etiquetado
 * o "AI trainer" que se publican cientos de veces. No se esconden (pueden servirle a alguien),
 * pero van al final del listado y no aparecen en la home.
 */
const LOW = /\b(ai trainer|ai tutor|ai training|data annotat\w*|annotator|label(l)?ing|rater|evaluator|linguist|transcri\w+|crowd\w*|freelance ai|survey)\b/i;

export const isLowQuality = (title: string) => LOW.test(title);
