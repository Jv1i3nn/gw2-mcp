# Guild Wars 2 MCP

Serveur [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) en TypeScript donnant accès à l’[API officielle Guild Wars 2](https://wiki.guildwars2.com/wiki/API:Main). Il permet à n’importe quel client MCP compatible (Claude, ChatGPT, IDE ou CLI) d’interroger les données publiques du jeu ainsi que les données de compte d’un joueur via sa propre clé API GW2.

> **Projet communautaire non officiel** — Ce dépôt est un projet personnel indépendant. Il n’est ni affilié, ni associé, ni autorisé, ni approuvé par ArenaNet, LLC ou NCSOFT Corporation.

## Fonctionnalités

- Transport MCP **Streamable HTTP** sur `POST /mcp`.
- Appel générique en lecture seule de l’ensemble des endpoints GW2 `v2` (et `v1` historiques).
- Prise en charge des paramètres standards (`ids`, `page`, `page_size`, `lang`, `v`, etc.).
- Validation stricte des chemins pour empêcher toute utilisation comme proxy HTTP arbitraire.
- Authentification multi-utilisateur **OAuth 2.1 sans base de données** :
  - découverte RFC 9728 (`/.well-known/oauth-protected-resource`) et métadonnées du serveur d’autorisation (`/.well-known/oauth-authorization-server`) ;
  - enregistrement dynamique de client (RFC 7591) sur `/oauth/register` ;
  - flux Authorization Code avec PKCE `S256` ;
  - clé API GW2 chiffrée et authentifiée en **AES-256-GCM** directement dans le jeton, sans stockage serveur.

## Outils MCP

### `gw2_api_get`

Appelle n’importe quel endpoint officiel GW2 en lecture seule.

Exemple pour des objets publics :

```json
{
  "endpoint": "v2/items",
  "query": {
    "ids": [19721, 19684],
    "lang": "fr"
  }
}
```

Exemple pour la banque du compte authentifié :

```json
{
  "endpoint": "v2/account/bank",
  "authenticated": true
}
```

### `gw2_api_endpoints`

Retourne les 183 routes `v2` annoncées par ArenaNet, regroupées par famille, avec les segments dynamiques (`:id`, `:board`, `:region`, `:guild_id`, `:team`) et les paramètres communs.

## Clé API Guild Wars 2

Pour interroger les routes privées (`v2/account/...`, `v2/characters/...`, `v2/commerce/transactions/...`), chaque utilisateur génère sa propre clé sur le portail officiel [account.arena.net/applications](https://account.arena.net/applications) avec les permissions souhaitées (`account`, `characters`, `inventories`, `tradingpost`, `wallet`, `unlocks`, `pvp`, `builds`, `progression`, `guilds`).

L’API officielle Guild Wars 2 est strictement en lecture seule : une clé API ne permet aucune modification sur le compte de jeu.

## Installation et exécution

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run build
npm test
```

Configurer le secret de chiffrement des jetons OAuth :

```bash
export OAUTH_SECRET="$(openssl rand -base64 32)"
```

Le projet ne lit aucun fichier de clé local et n’utilise aucune clé GW2 partagée dans les variables d’environnement : seule `OAUTH_SECRET` est requise côté serveur. Un fichier [`vercel.json`](./vercel.json) est inclus si vous souhaitez déployer le serveur en fonction serverless, mais n’importe quel hébergement Node.js convient.

## Fonctionnement de l’authentification OAuth 2.1

1. Le client MCP découvre les endpoints OAuth via `/.well-known/oauth-protected-resource` et `/.well-known/oauth-authorization-server`.
2. L’utilisateur est redirigé vers `/oauth/authorize` et saisit sa clé API Guild Wars 2.
3. Le serveur vérifie la validité de la clé auprès de `https://api.guildwars2.com/v2/tokeninfo`.
4. La clé est chiffrée (AES-256-GCM) dans un code d’autorisation temporaire (5 minutes), échangé ensuite sur `/oauth/token` via PKCE `S256` contre un jeton d’accès (valable 7 jours).
5. À chaque requête sur `/mcp`, le serveur déchiffre le jeton reçu pour interroger l’API GW2 au nom de l’utilisateur.

> **Note sur le mode stateless** : l’absence de base de données implique qu’un code d’autorisation n’est pas marqué comme consommé côté serveur. La vérification PKCE `S256`, la liaison au `client_id` / `redirect_uri` et la durée de vie de 5 minutes protègent l’échange ; une garantie stricte d’usage unique nécessiterait un stockage partagé (Redis / KV).

## Sécurité

- Ne jamais committer une clé API GW2 ni la valeur de `OAUTH_SECRET`.
- Ne jamais journaliser les clés API ou les jetons OAuth.
- Exposer le serveur uniquement en HTTPS en production.
- Une rotation de `OAUTH_SECRET` invalide immédiatement tous les jetons existants.

## Structure

```text
index.ts             Routeur HTTP principal (MCP et OAuth)
api/mcp.ts           Gestionnaire du transport MCP Streamable HTTP
src/auth.ts          Interface de résolution de la clé utilisateur
src/http.ts          Utilitaires HTTP
src/oauth.ts         Endpoints OAuth 2.1 et validation de la clé GW2
src/oauth-token.ts   Chiffrement AES-256-GCM des codes et jetons
src/gw2-client.ts    Client HTTP sécurisé de l’API GW2
src/endpoints.ts     Catalogue des endpoints GW2 v2
src/mcp-server.ts    Déclaration des outils MCP
test/                Tests automatisés
```

## Licence et mentions légales

Le code source de ce dépôt est distribué sous licence [MIT](./LICENSE).

© ArenaNet, LLC. Tous droits réservés. NCSOFT, ArenaNet, Guild Wars, Guild Wars 2 et tous les logos et designs associés sont des marques commerciales ou déposées de NCSOFT Corporation. Toutes les autres marques appartiennent à leurs propriétaires respectifs.
