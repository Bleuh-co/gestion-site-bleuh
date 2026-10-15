/**
 * `heic-convert` n'embarque pas de types et n'a pas de paquet `@types/`
 * séparé (vérifié le 15/10/2026, voir node_modules/heic-convert/package.json).
 * On ne déclare que la forme réellement utilisée ici (lib/studio-chanv.ts) :
 * `one()` exporté par défaut, qui résout un Buffer (cf. heic-convert/lib.js —
 * `formats-node.js`.JPEG renvoie `jpegJs.encode(...).data`, un Buffer Node).
 */
declare module "heic-convert" {
  interface HeicConvertOptions {
    buffer: Buffer | Uint8Array;
    format: "JPEG" | "PNG";
    /** 0–1, défaut 0.92 côté bibliothèque. */
    quality?: number;
  }

  function convert(options: HeicConvertOptions): Promise<Buffer>;

  export default convert;
}
