# Utils - src/utils

Utilitaires communs.

## Fichiers
- mod.rs : re-export des erreurs et resultats API.
- config.rs : lecture des variables d'environnement (DATABASE_URL, JWT_SECRET, JWT_EXP_SECONDS, BIND_ADDR).
- error.rs : ApiError et mapping HTTP, conversions d'erreurs sqlx/jwt.
- validation.rs : validation simple des champs (username, password, server name, channel name).
