# Presentation Keynote - RTC Chat Project

Format pense pour une presentation de 7 a 10 minutes.
Chaque slide contient :
- ce qui doit apparaitre a l'ecran ;
- les points a dire a l'oral ;
- un visuel suggere pour rendre la keynote plus claire.

## Slide 1 - Titre

**A l'ecran**

RTC Chat Project  
Application full-stack de messagerie temps reel inspiree de Discord

Stack :
- Rust + Axum
- PostgreSQL
- Next.js + React
- WebSocket

**A dire**

Nous avons developpe une application de messagerie collaborative en temps reel, avec une architecture complete front et back. L'objectif etait de proposer une experience proche de Discord, avec authentification, serveurs, salons, messages, presence en ligne et messages prives.

**Visuel suggere**

Capture de l'ecran principal ou mockup avec la sidebar serveurs, la liste des salons et la zone de chat.

---

## Slide 2 - Besoin et objectif

**A l'ecran**

Probleme :
- centraliser les conversations par communautes ;
- gerer les echanges publics et prives ;
- fournir une experience temps reel fluide.

Objectif produit :
- creer des serveurs ;
- organiser des salons ;
- discuter en direct ;
- gerer les roles et les acces.

**A dire**

Le coeur du projet, c'etait de construire une vraie plateforme de communication, pas seulement un chat basique. On voulait un systeme structure autour de serveurs et de salons, avec des permissions, du temps reel et une base de donnees persistante.

**Visuel suggere**

Schema simple "Utilisateur -> Serveur -> Salon -> Messages / DM".

---

## Slide 3 - Fonctionnalites principales

**A l'ecran**

Fonctionnalites implementees :
- inscription, connexion, deconnexion ;
- authentification JWT avec cookies HttpOnly ;
- creation et gestion de serveurs ;
- salons de discussion ;
- envoi, edition, suppression et pin de messages ;
- reactions ;
- invitations ;
- amis et messages prives ;
- presence en ligne et indicateurs de frappe.

**A dire**

Le projet couvre les usages essentiels d'une application de communication moderne. On a a la fois la partie communautaire avec les serveurs et salons, et la partie relationnelle avec les amis et les messages prives.

**Visuel suggere**

Matrice de fonctionnalites ou 3 colonnes : Auth, Collaboration, Temps reel.

---

## Slide 4 - Parcours utilisateur

**A l'ecran**

Scenario de demonstration :
1. un utilisateur cree un compte ;
2. il cree ou rejoint un serveur ;
3. il entre dans un salon ;
4. il envoie un message ;
5. les autres membres le recoivent instantanement ;
6. il peut ensuite basculer vers un message prive.

**A dire**

Le flux principal est simple et fluide. Des la connexion, l'utilisateur retrouve ses serveurs, navigue entre les salons, discute en temps reel et peut continuer une conversation en prive sans changer de plateforme.

**Visuel suggere**

Frise horizontale du parcours ou captures successives de l'application.

---

## Slide 5 - Architecture generale

**A l'ecran**

Architecture :
- Frontend : Next.js App Router + React 19
- Backend : Rust, Axum, Tokio
- Base de donnees : PostgreSQL avec SQLx
- Temps reel : WebSocket

Flux :
Frontend <-> API REST <-> PostgreSQL  
Frontend <-> WebSocket <-> Hub temps reel

**A dire**

Nous avons separe clairement les responsabilites. Le frontend gere l'interface et l'experience utilisateur. Le backend expose les endpoints REST, gere l'authentification, les regles metier et les acces a la base. Le WebSocket complete le REST pour toute la partie evenementielle en direct.

**Visuel suggere**

Diagramme 4 blocs : Frontend, API Rust, WebSocket Hub, PostgreSQL.

---

## Slide 6 - Focus temps reel

**A l'ecran**

Evenements WebSocket geres :
- nouveaux messages ;
- mise a jour et suppression ;
- notifications serveur ;
- utilisateurs connectes/deconnectes ;
- indicateurs de frappe ;
- messages epingles ;
- reactions.

**A dire**

Le temps reel est un point fort du projet. Le backend maintient un hub de diffusion par serveur et par salon. La presence et l'etat de frappe sont gardes en memoire pour une reactivite maximale, tandis que les messages restent persistants en base pour conserver l'historique.

**Visuel suggere**

Animation ou schema "client A envoie -> hub -> clients B/C recoivent".

---

## Slide 7 - Securite et permissions

**A l'ecran**

Securite :
- JWT pour authentifier les requetes ;
- mots de passe haches avec Argon2 ;
- tokens revocables ;
- controle d'acces sur les routes.

Roles :
- Member ;
- Admin ;
- Owner.

**A dire**

On ne s'est pas limite a faire fonctionner le chat. On a aussi structure les permissions. Par exemple, un membre peut discuter, alors qu'un administrateur peut moderer les messages et gerer les salons. L'authentification passe par JWT, et les mots de passe sont stockes de facon securisee avec Argon2.

**Visuel suggere**

Tableau simple des roles et de leurs capacites.

---

## Slide 8 - Choix techniques

**A l'ecran**

Pourquoi cette stack ?
- Rust / Axum : performance, securite memoire, concurrence ;
- Tokio : execution asynchrone ;
- PostgreSQL : robustesse des donnees ;
- SQLx : requetes type-safe ;
- Next.js : structure front moderne et routage ;
- React : interface dynamique.

**A dire**

Le choix de Rust et Axum nous a permis d'avoir un backend robuste et adapte au temps reel. Cote frontend, Next.js apporte une structure claire, avec des routes, des composants et des proxies API qui simplifient les appels vers le backend.

**Visuel suggere**

Logos de la stack ou slide tres sobre avec 6 cartes technologiques.

---

## Slide 9 - Resultats du projet

**A l'ecran**

Etat actuel :
- application full-stack fonctionnelle ;
- 94 fichiers de code applicatif ;
- environ 10 951 lignes de code ;
- backend documente et teste via integration ;
- frontend verifiable par lint.

Valeur obtenue :
- experience proche d'une application de chat moderne ;
- architecture claire et extensible ;
- base solide pour aller plus loin.

**A dire**

Le projet n'est pas une maquette. C'est une application exploitable, avec un backend structure, une vraie base de donnees, du temps reel, et une separation nette entre couches. Le volume de code montre aussi qu'on a traite un produit complet, pas juste une preuve de concept.

**Visuel suggere**

Compteurs ou chiffres cles en grand format.

---

## Slide 10 - Limites et ameliorations

**A l'ecran**

Pistes d'amelioration :
- tests front automatises ;
- deploiement complet CI/CD ;
- gestion plus fine des notifications ;
- pieces jointes / fichiers ;
- moderation avancee ;
- meilleure persistance de la presence.

**A dire**

La base est solide, mais plusieurs evolutions sont naturelles. On peut encore renforcer la qualite avec plus de tests cote frontend, enrichir les usages avec les fichiers et les notifications, et pousser plus loin la partie production avec une chaine CI/CD complete.

**Visuel suggere**

Roadmap en 3 horizons : court terme, moyen terme, long terme.

---

## Slide 11 - Conclusion

**A l'ecran**

RTC Chat Project  
Une plateforme de communication temps reel moderne, securisee et evolutive.

**A dire**

Pour conclure, ce projet montre notre capacite a concevoir une application full-stack complete, a gerer des enjeux de temps reel, de securite et d'architecture, et a transformer un besoin fonctionnel en produit coherent.

**Visuel suggere**

Retour a une capture globale de l'application avec une phrase de cloture.

---

## Slide 12 - Questions

**A l'ecran**

Questions ?

**A dire**

On peut ensuite ouvrir sur les choix techniques, la partie temps reel, ou faire une demonstration live selon le temps disponible.

---

## Version courte si vous devez tenir en 5 minutes

Si le temps est serre, gardez seulement :
- Slide 1 - Titre
- Slide 2 - Besoin et objectif
- Slide 3 - Fonctionnalites principales
- Slide 5 - Architecture generale
- Slide 6 - Focus temps reel
- Slide 9 - Resultats du projet
- Slide 11 - Conclusion

---

## Conseils de mise en page dans Keynote

- Une idee forte par slide.
- Maximum 3 a 5 puces visibles.
- Utiliser surtout des captures produit et des schemas, pas des murs de texte.
- Mettre en avant le temps reel, la securite et la separation front/back.
- Prevoir une mini demo entre les slides 4 et 6 si le format le permet.

---

## Mini script de demo live

1. Connexion avec un utilisateur.
2. Affichage des serveurs disponibles.
3. Ouverture d'un salon.
4. Envoi d'un message et reception instantanee.
5. Illustration de l'indicateur de frappe.
6. Suppression ou edition d'un message.
7. Passage vers un message prive.

Ce script fonctionne bien en 60 a 90 secondes.
