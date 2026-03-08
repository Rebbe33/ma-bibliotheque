# 📚 Ma Bibliothèque

Application de gestion de livres et BD avec design comic/BD, multi-utilisateurs, sauvegarde Supabase et recherche Google Books.

## Stack technique
- **Next.js 14** (App Router)
- **Supabase** (Auth + PostgreSQL)
- **Tailwind CSS** (design comic)
- **Google Books API** (recherche de livres)
- **Vercel** (hébergement)

---

## 🚀 Déploiement en 5 étapes

### 1. Configurer Supabase
1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans **SQL Editor** et exécutez le contenu de `supabase-schema.sql`
3. Dans **Settings > Authentication > Providers**, activez **Google** si vous voulez la connexion Google
4. Récupérez dans **Settings > API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Configurer le projet localement
```bash
# Cloner votre repo
git clone https://github.com/VOTRE_USER/ma-bibliotheque
cd ma-bibliotheque

# Copier les variables d'environnement
cp .env.local.example .env.local
# Éditez .env.local avec vos clés Supabase

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

### 3. Pousser sur GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 4. Déployer sur Vercel
1. Allez sur [vercel.com](https://vercel.com) → **New Project**
2. Importez votre repo GitHub
3. Dans **Environment Variables**, ajoutez :
   - `NEXT_PUBLIC_SUPABASE_URL` = votre URL Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = votre clé anon
   - (optionnel) `NEXT_PUBLIC_GOOGLE_BOOKS_KEY` = votre clé Google Books
4. Cliquez **Deploy** !

### 5. Configurer l'URL de redirection OAuth (si Google activé)
Dans Supabase → **Authentication > URL Configuration** :
- **Site URL** : `https://VOTRE_APP.vercel.app`
- **Redirect URLs** : `https://VOTRE_APP.vercel.app/auth/callback`

---

## 🔑 Obtenir une clé Google Books (optionnel)
Sans clé, l'API est limitée à ~100 requêtes/jour. Avec une clé gratuite :
1. Allez sur [console.developers.google.com](https://console.developers.google.com)
2. Créez un projet → activez **Books API**
3. Créez une clé API
4. Ajoutez-la en tant que `NEXT_PUBLIC_GOOGLE_BOOKS_KEY`

---

## 📁 Structure du projet
```
app/
  auth/          → Page de connexion/inscription
  library/       → Bibliothèque principale
  wishlist/      → Liste de souhaits
  stats/         → Statistiques
  settings/      → Réglages + import/export
components/
  layout/        → AppLayout (nav du bas)
  ui/            → Composants réutilisables
lib/
  supabase.ts    → Client Supabase (browser)
  supabase-server.ts → Client Supabase (serveur)
  google-books.ts → Utilitaires Google Books API
types/           → Types TypeScript
supabase-schema.sql → Schéma de base de données
```

---

## ✨ Fonctionnalités
- 🔐 Connexion email/password + Google OAuth
- 📚 Gestion de livres (statut, note, notes personnelles)
- 🔍 Recherche Google Books (titre, auteur, ISBN)
- 📖 Import auto : couverture, pages, éditeur, série, ISBN
- ✨ Liste de souhaits avec priorités et "où trouver"
- 📊 Statistiques visuelles
- 💾 Import/Export JSON et CSV
- 📱 Interface mobile-first avec design comic/BD
- 🔄 Sauvegarde automatique en temps réel sur Supabase
