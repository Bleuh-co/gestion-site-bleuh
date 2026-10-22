/* Copié de marketing-mdh/test/faux-firestore.ts (lot L10), avec les chemins « a.b » de `update`. */
/**
 * Firestore simulé en mémoire pour les tests de magasin — heures d'écriture,
 * préconditions (`lastUpdateTime`), lots et transactions atomiques compris.
 * Juste ce que les magasins d'affiliés utilisent ; rien de plus.
 */

type Doc = { data: Record<string, unknown>; t: number };

export interface FauxFirestore {
  db: unknown;
  coll: (nom: string) => Map<string, Doc>;
  /** Pose un document (horodaté). */
  poser: (nom: string, id: string, data: Record<string, unknown>) => void;
  lire: (nom: string, id: string) => Record<string, unknown> | undefined;
  vider: () => void;
  /** Appelé après chaque lecture — pour glisser une écriture concurrente au bon moment. */
  apresLecture: { cb: ((collection: string) => void) | null };
}

export function creerFauxFirestore(): FauxFirestore {
  const bases = new Map<string, Map<string, Doc>>();
  let horloge = 1;
  const apresLecture: FauxFirestore["apresLecture"] = { cb: null };

  const coll = (nom: string) => {
    if (!bases.has(nom)) bases.set(nom, new Map());
    return bases.get(nom)!;
  };
  const erreur = (message: string, code: number) => Object.assign(new Error(message), { code });
  /** Copie profonde ; `FieldValue.delete()` efface le champ, comme Firestore. */
  const cloner = (data: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && (v as { methodName?: string }).methodName === "FieldValue.delete") continue;
      try {
        out[k] = structuredClone(v);
      } catch {
        out[k] = v;
      }
    }
    return out;
  };
  const effaces = (data: Record<string, unknown>) =>
    Object.entries(data)
      .filter(([, v]) => v && typeof v === "object" && (v as { methodName?: string }).methodName === "FieldValue.delete")
      .map(([k]) => k);

  const instantane = (nom: string, id: string) => {
    const d = coll(nom).get(id);
    const copie = d ? structuredClone(d.data) : undefined;
    return {
      id,
      exists: !!d,
      ref: ref(nom, id),
      updateTime: d?.t,
      data: () => (copie ? structuredClone(copie) : undefined),
      get: (f: string) => copie?.[f],
    };
  };
  const signaler = (nom: string) => {
    const cb = apresLecture.cb;
    if (cb) cb(nom);
  };

  // Écritures élémentaires, vérifiées PUIS appliquées (atomicité des lots).
  type Op = { verifier: () => void; appliquer: () => void };
  const opSet = (nom: string, id: string, data: Record<string, unknown>, opts?: { merge?: boolean }): Op => ({
    verifier: () => {},
    appliquer: () => {
      const avant = opts?.merge ? coll(nom).get(id)?.data : undefined;
      if (!avant) return void coll(nom).set(id, { data: cloner(data), t: horloge++ });
      const suivant = { ...avant, ...cloner(data) };
      for (const k of effaces(data)) delete suivant[k];
      coll(nom).set(id, { data: suivant, t: horloge++ });
    },
  });
  const opDelete = (nom: string, id: string): Op => ({
    verifier: () => {},
    appliquer: () => void coll(nom).delete(id),
  });
  const opCreate = (nom: string, id: string, data: Record<string, unknown>): Op => ({
    verifier: () => {
      if (coll(nom).has(id)) throw erreur("ALREADY_EXISTS", 6);
    },
    appliquer: () => coll(nom).set(id, { data: cloner(data), t: horloge++ }),
  });
  const opUpdate = (nom: string, id: string, data: Record<string, unknown>, pre?: { lastUpdateTime?: number }): Op => ({
    verifier: () => {
      const d = coll(nom).get(id);
      if (!d) throw erreur("NOT_FOUND", 5);
      if (pre?.lastUpdateTime !== undefined && d.t !== pre.lastUpdateTime) throw erreur("FAILED_PRECONDITION", 9);
    },
    appliquer: () => {
      const d = coll(nom).get(id)!;
      const suivant: Record<string, unknown> = { ...d.data, ...cloner(data) };
      for (const k of effaces(data)) delete suivant[k];
      // Comme Firestore, `update` lit « a.b » comme un CHEMIN : il pose le
      // champ b dans la carte a, il ne crée pas un champ nommé « a.b ».
      for (const k of Object.keys(suivant).filter((c) => c.includes(".") && c in data)) {
        const [tete, ...reste] = k.split(".");
        let o = (suivant[tete] = structuredClone((suivant[tete] as Record<string, unknown>) ?? {})) as Record<string, unknown>;
        for (const p of reste.slice(0, -1)) o = (o[p] = (o[p] as Record<string, unknown>) ?? {}) as Record<string, unknown>;
        o[reste[reste.length - 1]] = suivant[k];
        delete suivant[k];
      }
      coll(nom).set(id, { data: suivant, t: horloge++ });
    },
  });
  const executer = (ops: Op[]) => {
    ops.forEach((o) => o.verifier());
    ops.forEach((o) => o.appliquer());
  };

  type Ref = { id: string; nom: string };
  function ref(nom: string, id: string) {
    return {
      id,
      nom,
      get: async () => {
        const s = instantane(nom, id);
        signaler(nom);
        return s;
      },
      set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => executer([opSet(nom, id, data, opts)]),
      delete: async () => executer([opDelete(nom, id)]),
      // Sous-collection : une collection à part, nommée par son chemin.
      collection: (sous: string) => collection(`${nom}/${id}/${sous}`),
      create: async (data: Record<string, unknown>) => executer([opCreate(nom, id, data)]),
      update: async (data: Record<string, unknown>, pre?: { lastUpdateTime?: number }) => executer([opUpdate(nom, id, data, pre)]),
    };
  }

  const requete = (nom: string, filtres: [string, string, unknown][] = []) => ({
    where: (f: string, op: string, v: unknown) => requete(nom, [...filtres, [f, op, v]]),
    get: async () => {
      const valeur = (data: Record<string, unknown>, chemin: string) =>
        chemin.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), data);
      const docs = [...coll(nom).entries()]
        .filter(([, d]) =>
          filtres.every(([f, op, v]) => {
            const x = valeur(d.data, f);
            if (op === "==") return x === v;
            if (op === "in") return Array.isArray(v) && v.includes(x);
            if (op === ">=") return String(x) >= String(v);
            return true;
          })
        )
        .map(([id]) => instantane(nom, id));
      signaler(nom);
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
  });

  const getAll = async (...refs: Ref[]) => {
    const snaps = refs.map((r) => instantane(r.nom, r.id));
    if (refs[0]) signaler(refs[0].nom);
    return snaps;
  };

  function collection(nom: string) {
    return { ...requete(nom), nom, doc: (id: string) => ref(nom, id) };
  }

  const db = {
    collection,
    getAll,
    // Supprime la collection et tout ce qui vit sous ses documents.
    recursiveDelete: async (r: { nom: string }) => {
      for (const nom of [...bases.keys()]) {
        if (nom === r.nom || nom.startsWith(`${r.nom}/`)) bases.delete(nom);
      }
    },
    bulkWriter: () => {
      const ops: Op[] = [];
      return {
        delete: async (r: Ref) => void ops.push(opDelete(r.nom, r.id)),
        close: async () => executer(ops),
      };
    },
    batch: () => {
      const ops: Op[] = [];
      return {
        set: (r: Ref, data: Record<string, unknown>) => void ops.push(opSet(r.nom, r.id, data)),
        create: (r: Ref, data: Record<string, unknown>) => void ops.push(opCreate(r.nom, r.id, data)),
        update: (r: Ref, data: Record<string, unknown>, pre?: { lastUpdateTime?: number }) =>
          void ops.push(opUpdate(r.nom, r.id, data, pre)),
        commit: async () => executer(ops),
      };
    },
    // Transaction : lectures directes, écritures mises de côté et appliquées
    // d'un bloc à la fin — ou pas du tout si la fonction lève.
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const ops: Op[] = [];
      const tx = {
        get: async (r: Ref) => instantane(r.nom, r.id),
        getAll: async (...refs: Ref[]) => refs.map((r) => instantane(r.nom, r.id)),
        set: (r: Ref, data: Record<string, unknown>, opts?: { merge?: boolean }) => void ops.push(opSet(r.nom, r.id, data, opts)),
        create: (r: Ref, data: Record<string, unknown>) => void ops.push(opCreate(r.nom, r.id, data)),
        update: (r: Ref, data: Record<string, unknown>) => void ops.push(opUpdate(r.nom, r.id, data)),
        delete: (r: Ref) => void ops.push(opDelete(r.nom, r.id)),
      };
      const resultat = await fn(tx);
      executer(ops);
      return resultat;
    },
  };

  return {
    db,
    coll,
    poser: (nom, id, data) => void coll(nom).set(id, { data: cloner(data), t: horloge++ }),
    lire: (nom, id) => (coll(nom).get(id) ? structuredClone(coll(nom).get(id)!.data) : undefined),
    vider: () => {
      bases.clear();
      horloge = 1;
      apresLecture.cb = null;
    },
    apresLecture,
  };
}
