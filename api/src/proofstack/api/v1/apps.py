"""Apps routes — compliance workspaces."""

from fastapi import APIRouter, Depends, HTTPException, status

from proofstack.core.auth import get_current_user
from proofstack.core.backboard import get_client
from proofstack.schemas.app import AppCreate, AppRead
from proofstack.schemas.user import User
from proofstack.services.app import AppService

router = APIRouter()


def _app_service(current_user: User = Depends(get_current_user)) -> AppService:
    return AppService(get_client(), current_user.assistant_id)


@router.get("", response_model=list[AppRead])
async def list_apps(svc: AppService = Depends(_app_service)):
    apps = await svc.list_apps()
    return [AppRead.from_app(a) for a in apps]


@router.post("", response_model=AppRead, status_code=status.HTTP_201_CREATED)
async def create_app(
    body: AppCreate,
    current_user: User = Depends(get_current_user),
    svc: AppService = Depends(_app_service),
):
    app = await svc.create_app(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
    )
    return AppRead.from_app(app)


@router.get("/{app_id}", response_model=AppRead)
async def get_app(app_id: str, svc: AppService = Depends(_app_service)):
    app = await svc.get_app(app_id)
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    return AppRead.from_app(app)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app(app_id: str, svc: AppService = Depends(_app_service)):
    deleted = await svc.delete_app(app_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")


