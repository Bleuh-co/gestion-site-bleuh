import { NextRequest, NextResponse } from "next/server";
import { requireRead, requireWrite } from "@/lib/auth-server";
import { recordAudit } from "@/lib/audit";
import { handleError, ValidationError } from "@/lib/products-service";
import { varietyKey } from "@/lib/variety-key";
import {
  deleteEditorial,
  getEditorial,
  normalizeAliasKeys,
  saveEditorial,
  validateEditorialInput,
} from "@/lib/variety-editorials";

export const runtime = "nodejs";

// Fiche éditoriale d'UNE variété : ce qu'on veut voir affiché pour elle,
// réglable avant même qu'elle n'entre en rotation.
//
// La clé de l'URL est recalculée (`varietyKey`) et non reprise telle quelle :
// l'écran peut aussi bien passer « HEADSTASH » que « head-stash », et les deux
// doivent viser le même document. Un id de doc Firestore accepterait sinon
// n'importe quelle graphie et on se retrouverait avec deux fiches rivales
// pour la même variété.
// Pas de decodeURIComponent : Next a déjà décodé le segment, et un second
// passage lèverait URIError (donc un 500) sur un nom contenant un « % ».
// De toute façon `varietyKey` ne retient que [a-z0-9].
function parseKey(raw: string): string {
  const key = varietyKey(raw);
  if (!key) throw new ValidationError("Identifiant de variété invalide.");
  return key;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  try {
    await requireRead();
    const { key: rawKey } = await ctx.params;
    const key = parseKey(rawKey);

    const fiche = await getEditorial(key);
    if (!fiche) {
      return NextResponse.json({ error: "Aucune fiche pour cette variété." }, { status: 404 });
    }
    return NextResponse.json(fiche);
  } catch (error) {
    return handleError(error, "GET /api/varietes/fiches/[key]");
  }
}

// PUT — crée ou remplace la fiche. Pas de PATCH : le formulaire envoie tous
// les champs, et vider un champ doit l'effacer (cf. saveEditorial).
export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  try {
    const session = await requireWrite();
    const { key: rawKey } = await ctx.params;
    const key = parseKey(rawKey);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Corps de requête JSON invalide.");
    }

    const input = validateEditorialInput(body);

    // Le nom doit désigner la variété visée : accepter « Blue Dream » sous la
    // clé de « Headstash » créerait une fiche qui ne s'appliquerait jamais,
    // puisque le rapprochement avec les cartes se fait sur le nom.
    if (varietyKey(input.name) !== key) {
      throw new ValidationError(
        "Le nom de la fiche ne correspond pas à la variété visée par l'adresse."
      );
    }

    const aliasKeys = normalizeAliasKeys(
      (body as Record<string, unknown>).aliasKeys,
      key
    );

    const fiche = await saveEditorial(key, input, aliasKeys, session.email);
    await recordAudit(session, "variete.fiche.save", `variety_editorials/${key}`, {
      name: fiche.name,
      category: fiche.category,
    });

    return NextResponse.json(fiche);
  } catch (error) {
    return handleError(error, "PUT /api/varietes/fiches/[key]");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  try {
    const session = await requireWrite();
    const { key: rawKey } = await ctx.params;
    const key = parseKey(rawKey);

    const existed = await deleteEditorial(key);
    if (!existed) {
      return NextResponse.json({ error: "Aucune fiche pour cette variété." }, { status: 404 });
    }
    await recordAudit(session, "variete.fiche.delete", `variety_editorials/${key}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error, "DELETE /api/varietes/fiches/[key]");
  }
}
