"""Auth routes: signup and login."""

from fastapi import APIRouter, Depends, HTTPException, status

from proofstack.core.auth import ROLE_PERMISSIONS, create_access_token, get_current_user
from proofstack.core.backboard import get_client
from proofstack.schemas.auth import CurrentUserRead, LoginRequest
from proofstack.schemas.user import TokenResponse, User, UserCreate, UserPublic, UserRole
from proofstack.services.user import UserService

router = APIRouter()


def _user_service() -> UserService:
    return UserService(get_client())


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(body: UserCreate, svc: UserService = Depends(_user_service)):
    """Create a new user. First user becomes admin."""
    # First user gets admin role
    role = UserRole.ADMIN if await svc.count() == 0 else UserRole.VIEWER

    # Provision a personal BB assistant for this user's apps
    client = get_client()
    asst = await client.create_assistant(
        name=f"proofstack-user-{body.email[:40]}",
        system_prompt="Personal assistant for ProofStack user apps.",
    )

    try:
        user = await svc.create_user(
            email=body.email,
            password=body.password,
            name=body.name,
            role=role,
            personal_assistant_id=str(asst.assistant_id),
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    token = create_access_token(user)
    return TokenResponse(access_token=token, user=UserPublic.from_user(user))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, svc: UserService = Depends(_user_service)):
    """Authenticate and return a JWT."""
    user = await svc.authenticate(body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_access_token(user)
    return TokenResponse(access_token=token, user=UserPublic.from_user(user))


@router.get("/me", response_model=CurrentUserRead)
async def me(current_user: User = Depends(get_current_user)):
    """Return current user info and permissions."""
    perms = sorted(ROLE_PERMISSIONS.get(current_user.role.value, []))
    return CurrentUserRead(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role.value,
        permissions=perms,
        assistant_id=current_user.assistant_id,
    )
