# VerticalStudio Full-Stack Template

A modern, production-ready template for building full-stack React applications using React Router, Supabase, and Prisma.

---
<img width="1086" height="897" alt="www" src="https://github.com/user-attachments/assets/4e53ba1a-5168-45f9-a60d-418a311b7cc1" />


1. Chat view
2. Prmpt input
3. Pipeline Builder tool
4. Auto suggest workflow
5. Run workflow

## Running Project
<img width="695" height="256" alt="Screenshot_3" src="https://github.com/user-attachments/assets/eb33d20b-dd22-4f31-92b4-bb03bfa6d4f3" />

1. Input Prompt
<img width="727" height="483" alt="Screenshot_5" src="https://github.com/user-attachments/assets/d0a2ce68-bd8e-44f4-b2df-7da590e8dc3f" />

2. Build pipeline (or auto generate pipeline)
<img width="697" height="461" alt="Screenshot_6" src="https://github.com/user-attachments/assets/d98ef591-37f1-4c1b-9ca1-7ed7bf7b6626" />

4. Reorder or delete workflow
<img width="737" height="149" alt="Screenshot_7" src="https://github.com/user-attachments/assets/482e5be8-a5de-40a6-a0b9-c084338a4ffd" />

6. Run workflow


## 🚀 Project Overview

This template provides a robust starting point for scalable web apps, featuring:
- Server-side rendering
- Hot Module Replacement (HMR)
- Asset bundling and optimization
- Data loading and mutations
- TypeScript by default
- TailwindCSS for styling
- Supabase for authentication and database
- Prisma for type-safe database access

---

## 📁 Folder Structure

```
verticalstudio/
├── app/                # Main application code (routes, layouts, components)
│   ├── assets/         # Static assets (images, icons)
│   ├── layouts/        # Layout components (Navbar, etc.)
│   ├── routes/         # Route modules (home, auth, etc.)
│   ├── util/           # Utility modules (supabase client, helpers)
│   └── ...
├── prisma/             # Prisma schema and migrations
├── supabase/           # Supabase config and migrations
├── public/             # Public static files
├── package.json        # Project dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── README.md           # Project documentation
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL=your-database-url
DIRECT_URL=your-direct-database-url
```

---

## 🛠️ Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:3000`.

### 3. Building for Production

Create a production build:

```bash
npm run build
```

---

## 🧑‍💻 Supabase Setup

※ Prisma can't access supabase functions & triggers and RLS. it should be enabled by supabase cli.

1. **Initialize Supabase**
   ```bash
   npx supabase init
   ```
2. **Login to Supabase**
   ```bash
   npx supabase login
   ```
3. **Link Supabase Project**
   ```bash
   npx supabase link
   ```
4. **Link Supabase Project**
   ```bash
   npx supabase migration new <migration file>
   ```
5. **Migrate Database**
   ```bash
   npx supabase db push
   ```

---

## 🗄️ Prisma Setup

1. **Install and Initialize Prisma**
   ```bash
   npm install prisma --save-dev
   npx prisma init
   ```
2. **Connect Prisma to Supabase Database**
   - Update `.env` with your Supabase connection strings.
3. **Edit `schema.prisma`**
   ```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
4. **Generate Migration & SQL File**
   ```bash
   npx prisma migrate dev --name init
   ```
5. **Use Prisma Client in App**
   ```ts
   import { PrismaClient } from '@prisma/client'
   const prisma = new PrismaClient()
   const users = await prisma.user.findMany()
   console.log(users)
   ```
6. **Push to Supabase with CLI (optional)**
   ```bash
   supabase db diff
   supabase db push
   ```

---


## 🚀 Deployment

Deploy to Vercel:

```ts
"scripts": {
    "build": "prisma generate && react-router build",
    ...
    "postinstall": "prisma generate"
  },
```


---

## 🎨 Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

## 🤝 Contributing

Contributions are welcome! Please open issues and pull requests for improvements or bug fixes.

---

## 📄 License

This project is licensed under the MIT License.

---

## 📬 Contact

For questions or support, open an issue or contact the maintainer.

---

Built with ❤️ using React Router, Supabase, and Prisma.
