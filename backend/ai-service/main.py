from fastapi import FastAPI

from app.api.parsing import router as parsing_router

app = FastAPI()
app.include_router(parsing_router)

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Service API"}
