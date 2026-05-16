import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import { options, type Option } from "./schema";

/**
 * The default Catalog list: active Options only (Archived ones drop out), split
 * into the two kinds and ordered by name. Excludes nothing else — Tags and the
 * ranking are separate concerns.
 */
export async function getActiveCatalog(): Promise<{
  home: Option[];
  restaurants: Option[];
}> {
  const active = await db
    .select()
    .from(options)
    .where(eq(options.active, true))
    .orderBy(asc(options.name));

  return {
    home: active.filter((option) => option.kind === "home"),
    restaurants: active.filter((option) => option.kind === "restaurant"),
  };
}
