import { getActiveCatalog } from "../../db/queries";
import { placesEnabled } from "../../lib/places";
import { CatalogScreen } from "./catalog-screen";

/** The Catalog reads and writes the DB on every visit — never prerender it. */
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const { home, restaurants, allTags } = await getActiveCatalog();
  return (
    <CatalogScreen
      home={home}
      restaurants={restaurants}
      allTags={allTags}
      placesEnabled={placesEnabled()}
    />
  );
}
