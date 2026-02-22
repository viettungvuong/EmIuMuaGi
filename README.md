# EmIuMuaGi

A full-stack app with a **FastAPI** Python backend and **React (Vite)** frontend.

## Features

- 🔒 Password-protected access
- 📋 Item list view with delete support
- ➕ Add new items with name & description

## Project Structure

```
EmIuMuaGi/
├── backend/          # FastAPI Python backend
│   ├── main.py
│   ├── models.py
│   ├── routers/
│   │   ├── auth.py
│   │   └── items.py
│   ├── .env          # APP_PASSWORD=secret123
│   └── requirements.txt
└── frontend/         # React (Vite) frontend
    └── src/
        ├── pages/
        │   ├── PasswordPage.jsx
        │   ├── MainPage.jsx
        │   └── AddPage.jsx
        ├── api/client.js
        └── styles/
```

## Setup

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs at **http://localhost:8000**

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at **http://localhost:5173**

## Default Password

`secret123` (change in `backend/.env`)
