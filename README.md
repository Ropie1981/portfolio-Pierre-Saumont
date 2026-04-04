# Pierre Saumont — Portfolio Angular 21

Portfolio personnel Pierre SAUMONT ©2026.

## Design System

| Token               | Valeur             |
| ------------------- | ------------------ |
| `--color-primary`   | `#c8a0ff` (violet) |
| `--color-secondary` | `#4ded45` (vert)   |
| `--color-tertiary`  | `#ff46f9` (rose)   |
| `--color-bg`        | `#0a0a0a`          |
| `--font-headline`   | Syne (800)         |
| `--font-mono`       | JetBrains Mono     |
| `--font-body`       | DM Sans            |

## Structure

```
src/
├── index.html
├── main.ts
├── styles.scss              ← Design tokens, animations globales
└── app/
    ├── app.component.ts     ← Root component
    ├── app.routes.ts
    └── components/
        ├── navbar/          ← Fixed, scroll-aware, hamburger mobile
        ├── home/            ← Full-screen, ticker animé, stats
        ├── about/           ← Profil, contact, langues
        ├── skills/          ← Mixing board (faders VU-mètres)
        ├── experience/      ← Timeline + sidebar formation
        ├── projects/        ← Cards grid avec hover brutaliste
        ├── contact/         ← Formulaire réactif + panel info
        └── footer/          ← Status, links, copyright
```

## Installation & Lancement

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement
npm start
# → http://localhost:4200

# 3. Build production
npm run build
# → dist/portfolio/
```

## Personnalisation

### Ajouter votre photo

Dans `about.component.ts`, remplacez le bloc `.photo-placeholder` par une vraie `<img>` :

```html
<img src="assets/photo.jpg" alt="Pierre Saumont" class="photo-img" />
```

### Ajouter vos vrais liens GitHub / LinkedIn

Recherchez `https://github.com` et `https://linkedin.com` dans les composants et remplacez par vos URLs réelles.

### Wirer le formulaire de contact

Dans `contact.component.ts`, méthode `onSubmit()` :

```typescript
onSubmit() {
  // Exemple avec EmailJS ou une API backend
  emailjs.send('service_id', 'template_id', this.form);
}
```

## Sections

| #   | ID            | Label dans la nav |
| --- | ------------- | ----------------- |
| 01  | `#about`      | PROFIL            |
| 02  | `#skills`     | STACK             |
| 03  | `#experience` | EXPÉRIENCES       |
| 04  | `#projects`   | PROJETS           |
| 05  | `#contact`    | CONTACT           |

## Déploiement

```bash
# Build
npm run build

```

---

©2026 Pierre Saumont — Villeurbanne, Lyon
