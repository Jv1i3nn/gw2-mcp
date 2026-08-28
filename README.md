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

La couche OAuth 2.1 requise par ChatGPT reste à implémenter. La version actuelle ne doit donc pas encore être considérée comme une intégration ChatGPT multi-utilisateur prête pour la production.

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

Retourne les principales familles d’endpoints et quelques modèles de chemins. `gw2_api_get` accepte également les endpoints absents de cette liste indicative.

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

## Authentification multi-utilisateur prévue

ChatGPT ne peut pas envoyer directement une clé API GW2 personnalisée comme mécanisme d’authentification MCP. Un serveur MCP authentifié doit exposer un flux OAuth 2.1 compatible avec la spécification MCP.

Le flux prévu ne nécessite ni compte applicatif, ni email, ni mot de passe :

1. ChatGPT ouvre la page d’autorisation hébergée sur Vercel.
2. L’utilisateur saisit sa clé API GW2.
3. Le serveur valide cette clé auprès de l’API GW2.
4. La clé est placée dans un jeton chiffré et signé de courte durée.
5. ChatGPT reçoit uniquement le jeton OAuth.
6. La fonction MCP déchiffre le jeton pour appeler GW2 au nom de cet utilisateur.

Cette approche permet de se passer de base de données. Elle nécessitera au minimum un secret de chiffrement `OAUTH_SECRET` configuré exclusivement dans les variables d’environnement Vercel.

Endpoints OAuth restant à ajouter :

- `/.well-known/oauth-protected-resource` ;
- `/.well-known/oauth-authorization-server` ;
- `/oauth/authorize` ;
- `/oauth/token` ;
- Authorization Code avec PKCE S256 ;
- validation de l’émetteur, de l’audience, des portées et de l’expiration ;
- réponses `401` accompagnées de `WWW-Authenticate`.

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
api/mcp.ts           Route MCP Vercel
src/auth.ts          Interface de résolution de la clé utilisateur
src/gw2-client.ts    Client HTTP sécurisé de l’API GW2
src/endpoints.ts     Catalogue indicatif des endpoints
src/server.ts        Déclaration des outils MCP
test/                Tests automatisés
vercel.json          Configuration Vercel
```

## Ressources

- [API Guild Wars 2](https://wiki.guildwars2.com/wiki/API:Main)
- [Authentification MCP pour ChatGPT](https://developers.openai.com/plugins/build/auth)
- [Model Context Protocol](https://modelcontextprotocol.io/)
