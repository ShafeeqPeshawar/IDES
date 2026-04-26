# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

igniUp is a browser-based Python IDE with user authentication, cloud program storage, and a gamification system (badges/points). The application consists of:

- **Frontend**: Static HTML/CSS/JS files served from the root directory
- **Backend**: Express.js server in `server/` with MongoDB for data persistence
- **Python Execution**: Client-side using Pyodide (v0.24.1) - Python runs entirely in the browser

## Architecture

### Backend Structure

The Express server (`server/index.js`) serves both the API and static frontend files:

- **API Routes**:
  - `/api/auth` - User registration, login, password changes, profile data
  - `/api/programs` - CRUD operations for saved Python programs
- **Static Files**: All non-API requests serve static HTML/CSS/JS from the root directory
- **Authentication**: JWT tokens (7-day expiry) with Bearer token middleware
- **Database**: MongoDB with two collections via Mongoose models:
  - `User` - name, email, hashed password (bcrypt)
  - `Program` - userId, title, code, codeHash, executedSuccessfully, timestamps

### Gamification System

- Users earn 10 points per unique successfully-executed program
- Code deduplication via SHA-256 hash of normalized code (case-insensitive, whitespace-collapsed)
- Badge system defined in `server/config/badges.js` (must match frontend badges in `profile.html`)
- Achievement emails sent via nodemailer when badges are unlocked (supports SMTP or Ethereal test mode)

### Frontend Pages

- `index.html` - Landing page with theme toggle and auth state
- `authenticate.html` - Login/signup forms
- `New-Python-IDE.html` - Main Python editor with Pyodide integration
- `profile.html` - User profile with stats, badges, saved programs

## Development Commands

### Initial Setup

```bash
# Install MongoDB (local or use MongoDB Atlas cloud)
# See GETTING_STARTED.md for detailed MongoDB setup instructions

cd server
npm install

# Create server/.env file with:
# PORT=3000
# MONGODB_URI=mongodb://localhost:27017/igniup
# JWT_SECRET=your-random-secret-string
```

### Running the Application

```bash
cd server
npm start
```

Server runs at `http://localhost:3000` and serves both API and frontend.

**Important**: Always access via `http://localhost:3000`, not by opening HTML files directly (file:// protocol causes CORS issues).

### Environment Variables

Required in `server/.env`:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT token signing
- `PORT` - Server port (default: 3000)

Optional (email notifications):
- `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_FROM` - SMTP configuration
- `MAIL_USE_ETHEREAL=true` - Use Ethereal test inbox for development

## Key Implementation Details

### Code Deduplication

Programs are deduplicated using `normalizeCodeForHash()` in `server/routes/programs.js`:
- Converts to lowercase
- Collapses whitespace
- Removes spaces around operators (=, +, -, *, /, etc.)
- This prevents duplicate points for trivially different code (e.g., "a=20" vs "A = 20")

### Authentication Flow

1. User registers/logs in via `/api/auth/register` or `/api/auth/login`
2. Server returns JWT token
3. Frontend stores token in localStorage via `js/api.js`
4. Protected routes require `Authorization: Bearer <token>` header
5. Middleware (`server/middleware/auth.js`) validates token and attaches `req.user`

### Program Execution Tracking

When a program is saved with `executedSuccessfully: true`:
1. Check if code hash already exists for this user (no duplicate points)
2. If new, create program and count total successful programs
3. Calculate new points (successCount * 10)
4. Check if any badges were newly unlocked
5. Send achievement email if badge unlocked

## Testing Notes

- No test suite currently exists
- Manual testing: Start server, create account at `http://localhost:3000/authenticate.html`, write/run Python code in IDE
- MongoDB must be running before starting the server
- Check browser console and server logs for errors
