from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator

from solver import solve_equations

app = FastAPI(
    title="Equation Solver API",
    description="Solve symbolic linear equations and systems of equations.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DIST = Path(__file__).parent / "frontend" / "dist"


class SolveRequest(BaseModel):
    equations: list[str]
    variables: Optional[list[str]] = None

    @field_validator("equations")
    @classmethod
    def equations_not_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("equations must not be empty.")
        for eq in v:
            if "=" not in eq:
                raise ValueError(f"Each equation must contain '=': {eq!r}")
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"equations": ["x + 2y = 3x - y"]},
                {"equations": ["x + 2y = 3", "2x - y = 1"]},
            ]
        }
    }


class SolveResponse(BaseModel):
    result: str
    solutions: list[dict[str, str]]
    free_variables: list[str]
    note: Optional[str] = None
    steps: list[dict[str, str]] = []
    graph_data: Optional[Any] = None


@app.post("/api/solve", response_model=SolveResponse)
@app.post("/solve", response_model=SolveResponse)
def solve_endpoint(request: SolveRequest):
    try:
        result = solve_equations(request.equations, request.variables)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Solver error: {exc}")
    return result


@app.get("/{full_path:path}")
async def serve_spa(full_path: str = ""):
    """Serve the React SPA. Specific static assets or index.html fallback."""
    if not DIST.exists():
        return {"message": "Equation Solver API — build frontend: cd frontend && npm run build"}
    target = DIST / full_path if full_path else DIST / "index.html"
    if target.is_file():
        return FileResponse(str(target))
    # SPA fallback
    return FileResponse(str(DIST / "index.html"))
