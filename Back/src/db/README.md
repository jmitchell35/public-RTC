# DB - src/db

Couche d'acces a la base PostgreSQL avec SQLx.

## Fichiers
- mod.rs : expose les sous-modules et lance les migrations SQL au demarrage.
- users.rs : creation et lecture des utilisateurs.
- servers.rs : creation, listing, mise a jour et suppression des serveurs (inclut creation du channel general et du owner).
- channels.rs : CRUD des channels.
- messages.rs : creation, listing pagine et suppression des messages.
- members.rs : gestion des membres et roles, transferts d'ownership, listing avec statut online.
- invites.rs : generation et consommation des invitations (expiration, max uses).
- tokens.rs : revocation et verification des JWT (table revoked_tokens).
