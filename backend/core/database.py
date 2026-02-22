from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "sqlite+aiosqlite:///./app.db"

engine = create_async_engine(DATABASE_URL, echo=False)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        # Import every model module so SQLAlchemy registers their tables
        import models.item          # noqa: F401
        import models.clothes       # noqa: F401
        import models.food_and_drink  # noqa: F401
        import models.others        # noqa: F401
        await conn.run_sync(Base.metadata.create_all)



async def get_db():
    """FastAPI dependency that yields a DB session."""
    async with AsyncSessionLocal() as session:
        yield session
