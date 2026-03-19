# Developer Directory - Backend

Backend API for the Developer Directory application built with Node.js, Express, and MySQL. This service acts as the core engine for connecting student developers with tech companies.

## 📖 About the Project / What It Does

This backend code serves as the data layer and business logic controller for the Developer Directory platform. Here is how it works under the hood:
* **User Management:** It manages three distinct user roles: Students, Companies, and Admins. It securely handles user registration, login, and issues JWTs (JSON Web Tokens) for session management.
* **Profile System:** It allows users with the "Student" role to create, read, and update their developer profiles, storing their skills, projects, and contact information in a MySQL database.
* **Bridging the Gap:** It provides endpoints for "Company" users to fetch lists of available developers, view their detailed profiles, and initiate contact.
* **Safety & Limits:** It includes a rate-limited contact system to prevent spam, ensuring companies can reach out to students in a controlled manner.

## 🚀 Features

* **JWT Authentication:** Secure login and registration.
* **Role-Based Access Control (RBAC):** Isolated permissions for Student, Company, and Admin endpoints.
* **Developer Profile Management:** Full CRUD operations for student portfolios.
* **Contact System:** Secure messaging/contact initiation with rate limiting.
* **Automated Database Setup:** MySQL database with automatic table creation (`users`, `developers`, `contacts`) upon initialization.

## 🛠 Tech Stack

* **Runtime & Framework:** Node.js, Express.js
* **Database:** MySQL
* **Security:** JWT (JSON Web Token)

## ⚙️ Installation & Setup

**1. Clone the repository:**
git clone [https://github.com/BenerKaraca/developer-directory-backend.git](https://github.com/BenerKaraca/developer-directory-backend.git)
cd developer-directory-backend
2. Install dependencies:

Bash
npm install
3. Configure Environment Variables:
Create a .env file in the root directory and add your configuration:

Kod snippet'i
PORT=5000
JWT_SECRET=your-secret-key-here
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=ogrencisistemi
4. Run the application:

Bash
# For development
npm run dev

# For production
npm start
📡 API Endpoints
Authentication:

POST /api/auth/register - Register new user

POST /api/auth/login - Login

GET /api/auth/me - Get current user

Developers:

GET /api/developers - Get all developers

POST /api/developers - Create developer profile (student only)

PUT /api/developers/:id - Update developer profile (student only)

Contacts & Admin:

POST /api/developers/:id/contact - View/Contact developer profile (company only)

GET /api/contacts/stats - Get contact stats (company only)

GET /api/admin/* - Admin endpoints
