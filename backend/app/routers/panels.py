from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.database import get_db
from app.models import Panel, PanelMember, User
from app.schemas import PanelCreate, PanelResponse, PanelUpdate

router = APIRouter(prefix="/api/panels", tags=["Panels"])


@router.get("/", response_model=List[PanelResponse])
def get_panels(db: Session = Depends(get_db)):
    return (
        db.query(Panel)
        .options(joinedload(Panel.members).joinedload(PanelMember.user))
        .all()
    )


@router.get("/{panel_id}", response_model=PanelResponse)
def get_panel(panel_id: int, db: Session = Depends(get_db)):
    panel = (
        db.query(Panel)
        .options(joinedload(Panel.members).joinedload(PanelMember.user))
        .filter(Panel.id == panel_id)
        .first()
    )
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    return panel


@router.post("/", response_model=PanelResponse)
def create_panel(data: PanelCreate, db: Session = Depends(get_db)):
    panel = Panel(name=data.name, description=data.description)
    db.add(panel)
    db.commit()
    db.refresh(panel)

    if data.member_ids:
        for uid in data.member_ids:
            user = db.query(User).filter(User.id == uid).first()
            if user:
                member = PanelMember(
                    panel_id=panel.id,
                    user_id=uid,
                    role_in_panel="lead" if user.role == "admin" else "member",
                )
                db.add(member)
        db.commit()

    return (
        db.query(Panel)
        .options(joinedload(Panel.members).joinedload(PanelMember.user))
        .filter(Panel.id == panel.id)
        .first()
    )


@router.put("/{panel_id}", response_model=PanelResponse)
def update_panel(panel_id: int, data: PanelUpdate, db: Session = Depends(get_db)):
    panel = db.query(Panel).filter(Panel.id == panel_id).first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    if data.name is not None:
        panel.name = data.name
    if data.description is not None:
        panel.description = data.description

    if data.member_ids is not None:
        db.query(PanelMember).filter(PanelMember.panel_id == panel_id).delete()
        for uid in data.member_ids:
            user = db.query(User).filter(User.id == uid).first()
            if user:
                member = PanelMember(
                    panel_id=panel.id,
                    user_id=uid,
                    role_in_panel="lead" if user.role == "admin" else "member",
                )
                db.add(member)

    db.commit()
    return (
        db.query(Panel)
        .options(joinedload(Panel.members).joinedload(PanelMember.user))
        .filter(Panel.id == panel.id)
        .first()
    )


@router.delete("/{panel_id}")
def delete_panel(panel_id: int, db: Session = Depends(get_db)):
    panel = db.query(Panel).filter(Panel.id == panel_id).first()
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    db.delete(panel)
    db.commit()
    return {"message": "Panel deleted successfully"}
