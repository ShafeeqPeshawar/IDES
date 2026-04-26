# Getting igniUp (with accounts & cloud save) to work

"Failed to fetch" or account not creating means the **backend server is not running** or the browser cannot reach it. Do the following.

---

## 1. Install MongoDB

The app stores users and programs in **MongoDB**.

- **Option A – Local:** Install [MongoDB Community](https://www.mongodb.com/try/download/community) and start the MongoDB service.
- **Option B – Cloud:** Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas), get a connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/igniup`), and use it in step 3 as `MONGODB_URI`.

---

## 2. Install and start the backend

Open a terminal in your project folder and run:

```bash
cd server
npm install
```

Create a file named `.env` inside the `server` folder (copy from `.env.example` if you prefer):

**If using local MongoDB:**

- Create `server/.env` with:
  ```
  PORT=3000
  MONGODB_URI=mongodb://localhost:27017/igniup
  JWT_SECRET=any-long-random-string-for-development
  ```

**If using MongoDB Atlas:**

- Use your Atlas connection string:
  ```
  PORT=3000
  MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/igniup
  JWT_SECRET=any-long-random-string-for-development
  ```

Then start the server:

```bash
npm start
```

You should see something like:

- `MongoDB connected`
- `Server running at http://localhost:3000`

If you see **MongoDB connection error**, MongoDB is not running or `MONGODB_URI` is wrong. Fix that before continuing.

---

## 3. Open the app in the browser

- Go to: **http://localhost:3000**
- Do **not** open the HTML files by double‑clicking (that uses `file://` and can cause "Failed to fetch"). Always use `http://localhost:3000` after starting the server.

Then:

1. Click **Login** → **Create Account** (or open `http://localhost:3000/authenticate.html#signup`).
2. Enter name, email, and password (at least 6 characters) and submit.
3. You should be logged in and redirected to the IDE. You can then use **Save to cloud** and **My programs**.

---

## Quick checklist

| Step | What to do |
|------|------------|
| 1 | MongoDB installed and running (local or Atlas). |
| 2 | `cd server` → `npm install` → create `server/.env` with `MONGODB_URI` and `JWT_SECRET` → `npm start`. |
| 3 | Open **http://localhost:3000** in the browser (not `file://`). |
| 4 | Create account from the auth page. |

If you still get "Failed to fetch", the backend is not reachable: ensure the server is running and you are using `http://localhost:3000`.
