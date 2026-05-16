import { asc, eq } from "drizzle-orm";
import { db } from "./index";
import { optionTags, options, tags, type Option } from "./schema";

/** An Option together with the names of the Tags attached to it. */
export type OptionWithTags = Option & { tags: string[] };

/**
 * The default Catalog list: active Options only (Archived ones drop out), split
 * into the two kinds and ordered by name. Each Option carries its attached Tag
 * names, and `allTags` is the full Tag vocabulary the form's autocomplete
 * suggests from. The ranking is a separate concern.
 */
export async function getActiveCatalog(): Promise<{
  home: OptionWithTags[];
  restaurants: OptionWithTags[];
  allTags: string[];
}> {
  const active = await db
    .select()
    .from(options)
    .where(eq(options.active, true))
    .orderBy(asc(options.name));

  const links = await db
    .select({ optionId: optionTags.optionId, name: tags.name })
    .from(optionTags)
    .innerJoin(tags, eq(optionTags.tagId, tags.id))
    .orderBy(asc(tags.name));

  const tagsByOption = new Map<string, string[]>();
  for (const link of links) {
    const list = tagsByOption.get(link.optionId) ?? [];
    list.push(link.name);
    tagsByOption.set(link.optionId, list);
  }

  const allTags = await db
    .select({ name: tags.name })
    .from(tags)
    .orderBy(asc(tags.name));

  const withTags = (option: Option): OptionWithTags => ({
    ...option,
    tags: tagsByOption.get(option.id) ?? [],
  });

  return {
    home: active.filter((o) => o.kind === "home").map(withTags),
    restaurants: active.filter((o) => o.kind === "restaurant").map(withTags),
    allTags: allTags.map((t) => t.name),
  };
}
