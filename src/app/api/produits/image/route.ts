import { NextRequest, NextResponse, after } from "next/server";
import { requireWrite } from "@/lib/auth-server";
import { handleError, ValidationError } from "@/lib/products-service";
import { assertUploadableImage, saveProductImage } from "@/lib/product-images";
import { pushImageToStudio } from "@/lib/studio-chanv";

/**
 * POST /api/produits/image — téléverse une image de produit.
 *
 * Corps : multipart/form-data
 *   file        (requis)  le fichier image
 *   productName (option)  nom du produit, pour nommer l'asset dans Studio
 *
 * Réponse : { url } — URL publique permanente à déposer dans le champ image
 * du formulaire. La route n'écrit RIEN dans Firestore : c'est l'enregistrement
 * du produit (POST/PATCH) qui porte l'URL. Deux raisons :
 *   1. à la création, le produit n'a pas encore d'identifiant (l'id est le
 *      slug FR, généré au moment du POST) — il n'y a rien à mettre à jour ;
 *   2. la route PATCH fusionne `{ ...doc.data(), ...body }` : deux écritures
 *      concurrentes sur `images` se marcheraient dessus. Un seul écrivain.
 *
 * L'image est ensuite versée à la bibliothèque Studio Chanv (marque Bleuh,
 * catégorie packaging) — en tâche d'arrière-plan via `after()`, car le pipeline
 * Studio (Drive + tag IA) prend plusieurs dizaines de secondes et ne doit pas
 * faire attendre l'utilisateur. Un échec côté Studio n'invalide jamais
 * l'upload : l'image est déjà en ligne et le produit peut être enregistré.
 */

export const runtime = "nodejs";
// Large : la réponse part vite, mais le dépôt Studio lancé par `after()`
// continue derrière (le service tourne avec le CPU toujours alloué,
// run.googleapis.com/cpu-throttling=false).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const session = await requireWrite();

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new ValidationError(
        "Requête invalide : envoyer le fichier en multipart/form-data (champ « file »)."
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("Aucun fichier reçu (champ « file »).");
    }

    const mimeType = file.type || "application/octet-stream";
    assertUploadableImage(mimeType, file.size);

    const bytes = Buffer.from(await file.arrayBuffer());
    // Le poids annoncé par le navigateur n'engage personne : on revalide sur
    // les octets réellement reçus.
    assertUploadableImage(mimeType, bytes.length);

    const stored = await saveProductImage({
      bytes,
      filename: file.name || "image",
      mimeType,
    });

    const productNameRaw = form.get("productName");
    const productName = typeof productNameRaw === "string" ? productNameRaw.trim() : "";

    console.log(
      `[produits/image] ${stored.filename} (${(bytes.length / 1024).toFixed(0)} Ko) déposée par ${session.email}`
    );

    // Dépôt dans la bibliothèque de marque APRÈS la réponse.
    after(async () => {
      await pushImageToStudio({
        bytes,
        filename: stored.filename,
        mimeType,
        displayName: productName || undefined,
        tags: productName ? [productName] : [],
      });
    });

    return NextResponse.json({ url: stored.url, path: stored.path, filename: stored.filename });
  } catch (error) {
    return handleError(error, "POST /api/produits/image");
  }
}
