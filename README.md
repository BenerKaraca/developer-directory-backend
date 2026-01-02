# Developer Directory Backend

Backend API for Developer Directory application built with Node.js, Express, and MySQL.

## Features

- JWT Authentication
- User roles: Student, Company, Admin
- Developer profile management
- Contact system with rate limiting
- MySQL database integration

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
JWT_SECRET=your-secret-key-here
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=ogrencisistemi
```

## Installation

```bash
npm install
```

## Run

```bash
npm start
# or for development
npm run dev
```

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `GET /api/developers` - Get all developers
- `POST /api/developers` - Create developer profile (student only)
- `PUT /api/developers/:id` - Update developer profile (student only)
- `POST /api/developers/:id/contact` - View developer profile (company only)
- `GET /api/contacts/stats` - Get contact stats (company only)
- `GET /api/admin/*` - Admin endpoints

## Database

The application uses MySQL. Tables are automatically created on first run:
- `users` - User accounts
- `developers` - Developer profiles
- `contacts` - Contact records

