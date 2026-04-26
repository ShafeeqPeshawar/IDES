# igniUp backend

Node.js + Express + MongoDB backend for user accounts and saving programs.

## Setup

1. **MongoDB**  
   Install [MongoDB](https://www.mongodb.com/try/download/community) and start it, or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and set `MONGODB_URI` in `.env`.

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Environment**  
   Copy `.env.nodemonexample` to `.env` and set:
   - `MONGODB_URI` – e.g. `mongodb://localhost:27017/igniup` or your Atlas connection string
   - `JWT_SECRET` – a long random string for production
   - `PORT` – optional, default 3000

4. **Run**
   ```bash
   npm start
   ```

The server runs at `http://localhost:3000`, serves the frontend from the parent folder, and exposes:

- `POST /api/auth/register` – create account (name, email, password)
- `POST /api/auth/login` – login (email, password) → returns `token` and `user`
- `GET /api/programs` – list current user’s programs (requires `Authorization: Bearer <token>`)
- `GET /api/programs/:id` – get one program
- `POST /api/programs` – create program (title, code)
- `PATCH /api/programs/:id` – update program (code, title, or set executedSuccessfully: true)
- `DELETE /api/programs/:id` – delete program

Open `http://localhost:3000` in the browser to use the app (home, login, IDE with cloud save and execution tracking).

### Achievement emails

When a user earns a new badge, the server can send a congratulations email. By default **no email is sent** (you’ll see a log line like “No mail sent (SMTP not configured)”).

- **Quick test (no real inbox):** In `server/.env` add `MAIL_USE_ETHEREAL=true`, restart the server, then earn a badge. The server console will print a **Preview URL** — open it in a browser to see the email.
- **Real email:** Configure SMTP in `server/.env` (see `.env.example`). For Gmail: use an [App Password](https://support.google.com/accounts/answer/185833), set `MAIL_HOST=smtp.gmail.com`, `MAIL_PORT=587`, `MAIL_USER` and `MAIL_PASS`.
