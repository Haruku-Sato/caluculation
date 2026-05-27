from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
    solutions: dict[str, str]
    free_variables: list[str]
    note: Optional[str] = None


@app.get("/")
def root():
    return {
        "message": "Equation Solver API",
        "usage": "POST /solve with {\"equations\": [\"x + 2y = 3x - y\"]}",
        "docs": "/docs",
    }


@app.post("/solve", response_model=SolveResponse)
def solve(request: SolveRequest):
    try:
        result = solve_equations(request.equations, request.variables)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Solver error: {exc}")
    return result
