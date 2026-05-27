"""
Vercel serverless function for the equation solver.
Accessible at POST /api/solve
"""
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from api.solver import solve_equations

app = FastAPI()

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


# Vercel passes the full URL path to the ASGI app
@app.post("/api/solve")
def solve(request: SolveRequest):
    try:
        return solve_equations(request.equations, request.variables)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Solver error: {exc}")
