import { Prisma } from "@prisma/client";
import {
  isShopSearchCodeToken,
  isShopVehicleSearchToken,
  shopSearchTokenPattern,
  SHOP_SEARCH_TOKEN_ALIASES,
} from "./shopSearch";

/** Match existing projection rows without requiring a catalog rebuild. */
export function shopSearchTokenConditionSql(text: Prisma.Sql, token: string) {
  const pattern = shopSearchTokenPattern(token);
  if (isShopVehicleSearchToken(token) || token === "fi" || SHOP_SEARCH_TOKEN_ALIASES[token]) {
    return Prisma.sql`${text} ~* ${pattern}`;
  }
  const escaped = token.replace(/([\\%_])/g, "\\$1");
  const substring = Prisma.sql`${text} ILIKE ${`%${escaped}%`} ESCAPE '\\'`;
  return token.length <= 2 || isShopSearchCodeToken(token)
    ? Prisma.sql`(${substring} AND ${text} ~* ${pattern})`
    : substring;
}
