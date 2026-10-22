import { NextRequest, NextResponse } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { ErreurMetier, reponseErreur } from "@/lib/erreur-metier";
import { assertUploadableImage, FORMATS_CAPTURE, saveProductImage } from "@/lib/product-images";

export const runtime = "nodejs";

/**
 * POST /api/site/captures — téléverse une capture jointe à une demande de
 * page ou d'infolettre (plan « Pages d'atterrissage et infolettres », lot L9).
 *
 * Corps : multipart/form-data, champ `file`.
 * Réponse : `{ success: true, url, path, filename }` — `url` (https, publique)
 * est ce que la demande transmet au hub dans `images`.
 *
 * Même dépôt que les images du catalogue (`saveProductImage`), dans un
 * dossier à part, `site-assets/atterrissages/AAAA/MM/`. Rien n'est versé à
 * Studio : une capture n'est pas un visuel de marque. La route n'écrit rien
 * dans Firestore : c'est la demande qui porte l'adresse.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ErreurMetier(
        "Téléversement interrompu : la capture n'est pas arrivée en entier. Réessayez ; si cela se reproduit, elle est probablement trop lourde (maximum 15 Mo).",
        400
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ErreurMetier("Aucun fichier reçu (champ « file »).", 400);
    }
    const mimeType = file.type || "application/octet-stream";
    if (!(FORMATS_CAPTURE as readonly string[]).includes(mimeType)) {
      throw new ErreurMetier(`Format non pris en charge pour une capture (${mimeType}). Formats acceptés : PNG, JPEG, WebP, GIF.`, 400);
    }
    assertUploadableImage(mimeType, file.size);

    const bytes = Buffer.from(await file.arrayBuffer());
    // Le poids annoncé par le navigateur n'engage personne : revalidé sur les octets reçus.
    assertUploadableImage(mimeType, bytes.length);

    const stored = await saveProductImage({
      bytes,
      filename: file.name || "capture",
      mimeType,
      dossier: "site-assets/atterrissages",
    });
    console.log(`[site/captures] ${stored.path} (${(bytes.length / 1024).toFixed(0)} Ko) déposée par ${session.email}`);

    return NextResponse.json({ success: true, url: stored.url, path: stored.path, filename: stored.filename });
  } catch (error) {
    return reponseErreur(error, "POST /api/site/captures");
  }
}
