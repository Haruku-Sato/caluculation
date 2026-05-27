import pytest
from solver import solve_equations


# --- Basic single-variable ---

def test_single_var_simple():
    result = solve_equations(["x + 2 = 5"])
    assert result["result"] == "unique"
    assert result["solutions"][0]["x"] == "3"


def test_single_var_negative():
    result = solve_equations(["x - 7 = 0"])
    assert result["result"] == "unique"
    assert result["solutions"][0]["x"] == "7"


# --- Implicit multiplication (2y → 2*y) ---

def test_implicit_multiplication():
    result = solve_equations(["2y = 4"])
    assert result["result"] == "unique"
    assert result["solutions"][0]["y"] == "2"


# --- Parametric (underdetermined) ---

def test_parametric_single_equation_two_vars():
    result = solve_equations(["x + 2y = 3x - y"])
    assert result["result"] == "parametric"
    assert "y" in result["free_variables"]
    assert "x" in result["solutions"][0]


# --- Unique system solution ---

def test_system_unique():
    result = solve_equations(["x + 2y = 3", "2x - y = 1"])
    assert result["result"] == "unique"
    assert result["solutions"][0]["x"] == "1"
    assert result["solutions"][0]["y"] == "1"


def test_system_three_vars():
    result = solve_equations([
        "x + y + z = 6",
        "2x - y + z = 3",
        "x + 2y - z = 2",
    ])
    assert result["result"] == "unique"
    assert result["solutions"][0]["x"] == "1"
    assert result["solutions"][0]["y"] == "2"
    assert result["solutions"][0]["z"] == "3"


# --- Quadratic (multiple solutions) ---

def test_quadratic_two_solutions():
    result = solve_equations(["x^2 = 4"])
    assert result["result"] == "multiple"
    assert len(result["solutions"]) == 2
    sol_values = {list(s.values())[0] for s in result["solutions"]}
    assert "-2" in sol_values
    assert "2" in sol_values


def test_quadratic_single_solution():
    result = solve_equations(["x^2 - 2x + 1 = 0"])
    assert result["result"] == "unique"
    assert result["solutions"][0]["x"] == "1"


# --- No solution ---

def test_no_solution_contradiction():
    result = solve_equations(["x = x + 1"])
    assert result["result"] == "no_solution"


# --- Error cases ---

def test_empty_equations_raises():
    with pytest.raises(ValueError, match="At least one"):
        solve_equations([])


def test_missing_equals_raises():
    with pytest.raises(ValueError):
        solve_equations(["x + y"])


def test_unknown_variable_raises():
    with pytest.raises(ValueError, match="not found"):
        solve_equations(["x + y = 3"], variable_names=["z"])
