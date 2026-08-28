export const endpointGroups = {
  account: ["v2/account", "v2/account/*", "v2/characters", "v2/characters/:id/*", "v2/tokeninfo"],
  achievements: ["v2/achievements", "v2/achievements/categories", "v2/achievements/groups"],
  commerce: ["v2/commerce/exchange/*", "v2/commerce/listings", "v2/commerce/prices", "v2/commerce/transactions/*"],
  game: ["v2/items", "v2/recipes", "v2/skins", "v2/skills", "v2/traits", "v2/professions", "v2/specializations"],
  guild: ["v2/guild/:id", "v2/guild/:id/*", "v2/guild/search", "v2/guild/upgrades"],
  maps: ["v2/continents", "v2/maps", "v2/floors", "v2/regions"],
  pvp: ["v2/pvp/*"],
  story: ["v2/stories", "v2/stories/seasons", "v2/quests"],
  wizardsVault: ["v2/wizardsvault/*"],
  wvw: ["v2/wvw/*"],
  meta: ["v2/build", "v2/files", "v2/quaggans", "v2/worlds"],
} as const;
