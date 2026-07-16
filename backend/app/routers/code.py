from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import subprocess
import tempfile
import os

from app.database import get_db
from app.models import CodeSubmission
from app.schemas import CodeSubmissionCreate, CodeSubmissionResponse

router = APIRouter(prefix="/api/code", tags=["Code"])


@router.post("/run")
def run_code(data: dict):
    """Execute code in a sandboxed environment and return output."""
    language = data.get("language", "python")
    code = data.get("code", "")

    if not code.strip():
        return {"output": "", "error": "No code provided"}

    try:
        if language == "python":
            result = _run_python(code)
        elif language == "javascript":
            result = _run_javascript(code)
        else:
            return {"output": "", "error": f"Unsupported language: {language}"}
        return result
    except Exception as e:
        return {"output": "", "error": str(e)}


def _run_python(code: str) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        f.flush()
        try:
            result = subprocess.run(
                ["python3", f.name],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return {
                "output": result.stdout,
                "error": result.stderr,
            }
        finally:
            os.unlink(f.name)


def _run_javascript(code: str) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
        f.write(code)
        f.flush()
        try:
            result = subprocess.run(
                ["node", f.name],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return {
                "output": result.stdout,
                "error": result.stderr,
            }
        except FileNotFoundError:
            return {"output": "", "error": "Node.js is not installed"}
        finally:
            os.unlink(f.name)


@router.post("/submit", response_model=CodeSubmissionResponse)
def submit_code(data: CodeSubmissionCreate, db: Session = Depends(get_db)):
    run_result = run_code({"language": data.language, "code": data.code})
    output = run_result.get("output", "") + run_result.get("error", "")

    submission = CodeSubmission(
        interview_id=data.interview_id,
        question_id=data.question_id,
        language=data.language,
        code=data.code,
        output=output,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


@router.get("/submissions/{interview_id}", response_model=List[CodeSubmissionResponse])
def get_submissions(interview_id: int, db: Session = Depends(get_db)):
    return (
        db.query(CodeSubmission)
        .filter(CodeSubmission.interview_id == interview_id)
        .order_by(CodeSubmission.submitted_at.desc())
        .all()
    )
