// Rôle interne Gestion Site Bleuh (mappé depuis le rôle standardisé Chanv)
// - superadmin : accès total
// - admin      : gestion + voir toutes les tâches
// - membre     : voir ses propres tâches (rôle Consulter)
// - blocked    : pas d'accès
export type Role = "superadmin" | "admin" | "membre" | "blocked";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Administrateur",
  admin: "Administrateur",
  membre: "Membre",
  blocked: "Bloqué",
};
