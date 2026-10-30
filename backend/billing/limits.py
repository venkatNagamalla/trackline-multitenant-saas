
from rest_framework.exceptions import APIException


PLAN_LIMITS = {
    "free": {
        "projects": 3,
        "members": 5,
    },
    "pro": {
        "projects": 100,
        "members": 100,
    },
}


class PlanLimitExceeded(APIException):
    status_code = 402
    default_detail = "Your current plan limit has been reached. Please upgrade your plan."
    default_code = "plan_limit_exceeded"


def check_limit(workspace, resource):
    """
    Check whether a workspace can create another resource.

    Supported resources: projects, members.
    """
    if resource not in PLAN_LIMITS["free"]:
        raise ValueError(f"Unknown resource: {resource}")

    plan = workspace.plan.lower()
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    maximum = limits[resource]

    if resource == "projects":
        current_usage = workspace.projects.count()

    elif resource == "members":
        current_usage = workspace.memberships.count()

    if current_usage >= maximum:
        raise PlanLimitExceeded(
            detail=(
                f"Your {plan.title()} plan allows a maximum of "
                f"{maximum} {resource}. Please upgrade to Pro "
                f"to increase your limit."
            )
        )
