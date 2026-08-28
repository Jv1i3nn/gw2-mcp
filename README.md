# Guild Wars 2 MCP

Serveur MCP TypeScript donnant accès à l’[API officielle Guild Wars 2](https://wiki.guildwars2.com/wiki/API:Main). Il est conçu pour être hébergé sur Vercel et, à terme, connecté à ChatGPT par plusieurs utilisateurs disposant chacun de leur propre clé API GW2.

## État du projet

Le cœur MCP est fonctionnel :

- transport MCP Streamable HTTP sur `POST /mcp` ;
- appel générique des endpoints GW2 v2 et des anciens endpoints v1 ;
- prise en charge des paramètres `ids`, `page`, `page_size`, `lang`, `v`, etc. ;
- validation des chemins afin de ne jamais transformer le serveur en proxy HTTP arbitraire ;
- transmission de la clé GW2 avec `Authorization: Bearer` vers ArenaNet ;
- compilation TypeScript et tests automatisés.

La couche OAuth 2.1 pour ChatGPT est intégrée : découverte RFC 9728, Authorization Code, PKCE S256, audience liée à `/mcp` et jetons AES-256-GCM sans stockage serveur.

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

Retourne les 183 routes v2 actuellement annoncées par ArenaNet, regroupées par famille, avec les segments dynamiques et les paramètres communs. Le catalogue est basé sur l’index vivant `https://api.guildwars2.com/v2`; l’ancien dépôt [ArenaNet API CDI](https://github.com/arenanet/api-cdi/) sert de documentation historique complémentaire pour les schémas.

## Installation locale

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run build
npm test
```

Le projet ne lit aucun fichier local `key` et ne prévoit aucune clé GW2 partagée dans les variables d’environnement.

## Déploiement Vercel

1. Importer ce dépôt GitHub dans Vercel.
2. Conserver `npm run build` comme commande de compilation.
3. Déployer le projet.
4. Utiliser ensuite la route MCP :

```text
https://votre-projet.vercel.app/mcp
```

Le fichier `vercel.json` redirige `/mcp` vers la fonction `api/mcp.ts`.

## Authentification multi-utilisateur

ChatGPT ne peut pas envoyer directement une clé API GW2 personnalisée comme mécanisme d’authentification MCP. Un serveur MCP authentifié doit exposer un flux OAuth 2.1 compatible avec la spécification MCP.

Le flux ne nécessite ni compte applicatif, ni email, ni mot de passe :

1. ChatGPT ouvre la page d’autorisation hébergée sur Vercel.
2. L’utilisateur saisit sa clé API GW2.
3. Le serveur valide cette clé auprès de l’API GW2.
4. La clé est placée dans un jeton chiffré et signé de courte durée.
5. ChatGPT reçoit uniquement le jeton OAuth.
6. La fonction MCP déchiffre le jeton pour appeler GW2 au nom de cet utilisateur.

Cette approche permet de se passer de base de données. Elle nécessite un secret de chiffrement `OAUTH_SECRET` configuré exclusivement dans les variables d’environnement Vercel.

Endpoints OAuth disponibles :

- `/.well-known/oauth-protected-resource` ;
- `/.well-known/oauth-authorization-server` ;
- `/oauth/authorize` ;
- `/oauth/token` ;
- `/oauth/authorize` valide la clé auprès de `/v2/tokeninfo` ;
- `/oauth/token` échange le code avec PKCE S256 ;
- `/mcp` valide l’audience, la portée et l’expiration ;
- les réponses `401` contiennent le challenge `WWW-Authenticate`.

### Configuration Vercel

Créer une variable secrète pour Production, Preview et Development :

```text
OAUTH_SECRET=<résultat de openssl rand -base64 32>
```

Le domaine canonique de production est `https://gw2-mcp.vercel.app`.

### Durées de vie

- code d’autorisation : 5 minutes ;
- token d’accès : 7 jours ;
- aucun refresh token : ChatGPT relance l’autorisation après expiration.

Le mode entièrement stateless ne permet pas de marquer un code d’autorisation comme consommé dans une base. PKCE empêche son utilisation sans le vérificateur secret du client, et sa durée de vie est limitée à cinq minutes. Une garantie stricte d’usage unique nécessiterait un stockage partagé tel que Vercel KV.

Voir la [documentation OpenAI sur l’authentification MCP](https://developers.openai.com/plugins/build/auth).

## Sécurité

- Ne jamais committer une clé API GW2.
- Ne jamais placer de clé GW2 partagée dans Vercel.
- Ne jamais écrire les clés ou les tokens dans les logs.
- Utiliser uniquement HTTPS en production.
- Faire expirer les tokens et permettre aux utilisateurs de reconnecter leur clé.
- Une rotation de `OAUTH_SECRET` invalidera tous les tokens existants.

## Structure

```text
index.ts             Point d’entrée du preset Node Vercel
api/mcp.ts           Route MCP Vercel
src/auth.ts          Interface de résolution de la clé utilisateur
src/http.ts          Utilitaires HTTP du routeur Vercel
src/oauth.ts         Endpoints OAuth et validation ChatGPT/GW2
src/oauth-token.ts   Chiffrement des codes et tokens
src/gw2-client.ts    Client HTTP sécurisé de l’API GW2
src/endpoints.ts     Catalogue indicatif des endpoints
src/mcp-server.ts    Déclaration des outils MCP
test/                Tests automatisés
vercel.json          Configuration Vercel
```

## Ressources

- [API Guild Wars 2](https://wiki.guildwars2.com/wiki/API:Main)
- [Authentification MCP pour ChatGPT](https://developers.openai.com/plugins/build/auth)
- [Model Context Protocol](https://modelcontextprotocol.io/)
