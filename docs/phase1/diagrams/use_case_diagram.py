"""Generate the UML use case diagram for the Bank Management System.

Usage (from the repository root):
    python3 docs/phase1/diagrams/use_case_diagram.py

Writes docs/phase1/use_case_diagram.png. Use case IDs follow
docs/phase1/actors_usecases.md.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Ellipse, Rectangle

OUTPUT = Path(__file__).resolve().parent.parent / "use_case_diagram.png"

# Actor colours (line) and use case fills, matching the original diagram style.
CUSTOMER = "#1f6aa5"
EMPLOYEE = "#2e8555"
ADMIN = "#d2691e"
FILL = {
    "customer": "#e3eefa",
    "employee": "#e1f3e8",
    "admin": "#fde8da",
    "customer_employee": "#f1e6f8",
    "employee_admin": "#f1e6f8",
    "all": "#fff4c2",
}

W, H = 2000, 1500  # drawing units
UC_W, UC_H = 480, 72
LEFT_X, RIGHT_X = 690, 1320
ROW_Y0, ROW_STEP = 175, 83

# (name, use case IDs, fill key, actors) in top-to-bottom order.
LEFT_COLUMN = [
    ("Transfer Funds", "UC-04", "customer", "C"),
    ("View Transaction History", "UC-05", "customer", "C"),
    ("Update Profile", "UC-06", "customer", "C"),
    ("Change Password", "UC-07", "customer", "C"),
    ("View Account Details", "UC-03, UC-14", "customer_employee", "CE"),
    ("Login", "UC-01, UC-08, UC-19", "all", "CEA"),
    ("Logout", "UC-02, UC-09, UC-20", "all", "CEA"),
    ("Register Customer", "UC-10", "employee", "E"),
    ("View Customer Details", "UC-11", "employee", "E"),
    ("Update Customer Information", "UC-12", "employee", "E"),
    ("Create Bank Account", "UC-13", "employee", "E"),
    ("Deposit Money", "UC-15", "employee", "E"),
    ("Withdraw Money", "UC-16", "employee", "E"),
    ("Manage Account Status", "UC-17", "employee", "E"),
    ("View Transaction Records", "UC-18, UC-24", "employee_admin", "EA"),
]
RIGHT_COLUMN = [
    ("Manage Employee Accounts", "UC-21", "admin", "A"),
    ("Manage Employee Status", "UC-25", "admin", "A"),
    ("View Customer Records", "UC-22", "admin", "A"),
    ("View Account Records", "UC-23", "admin", "A"),
    ("Generate Reports", "UC-26", "admin", "A"),
]

# Actor positions: (x, y of the arms, colour, label).
ACTORS = {
    "C": (140, 420, CUSTOMER, "Customer"),
    "E": (140, 960, EMPLOYEE, "Bank Employee"),
    "A": (1860, 640, ADMIN, "Administrator"),
}
ARM = 48


def draw_actor(ax, x, y, colour, label):
    kw = dict(color=colour, lw=3, solid_capstyle="round", zorder=4)
    ax.add_patch(Circle((x, y - 88), 30, fill=False, ec=colour, lw=3, zorder=4))
    ax.plot([x, x], [y - 58, y + 55], **kw)
    ax.plot([x - ARM, x + ARM], [y, y], **kw)
    ax.plot([x, x - 38], [y + 55, y + 135], **kw)
    ax.plot([x, x + 38], [y + 55, y + 135], **kw)
    ax.text(x, y + 175, label, ha="center", va="center", fontsize=14,
            fontweight="bold", color=colour)


def draw_use_case(ax, cx, cy, name, ids, fill):
    ax.add_patch(Ellipse((cx, cy), UC_W, UC_H, fc=FILL[fill], ec="#2b2b2b",
                         lw=1.6, zorder=3))
    ax.text(cx, cy - 11, name, ha="center", va="center", fontsize=11, zorder=5)
    ax.text(cx, cy + 16, ids, ha="center", va="center", fontsize=8.5,
            color="#555555", zorder=5)


def main():
    fig = plt.figure(figsize=(17, 12.75), dpi=150)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W)
    ax.set_ylim(H, 0)
    ax.set_aspect("equal")
    ax.axis("off")

    # System boundary.
    ax.add_patch(Rectangle((340, 40), 1350, 1380, fill=False, ec="black",
                           lw=2.5, zorder=1))
    ax.text(1015, 88, "Bank Management System", ha="center", va="center",
            fontsize=18, fontweight="bold")

    placed = []
    for i, (name, ids, fill, actors) in enumerate(LEFT_COLUMN):
        placed.append((LEFT_X, ROW_Y0 + i * ROW_STEP, name, ids, fill, actors))
    for i, (name, ids, fill, actors) in enumerate(RIGHT_COLUMN):
        placed.append((RIGHT_X, ROW_Y0 + i * ROW_STEP, name, ids, fill, actors))

    # Associations (drawn first so ellipses sit on top).
    for cx, cy, _, _, _, actors in placed:
        for key in actors:
            ax_x, ax_y, colour, _ = ACTORS[key]
            if key == "A":
                start, end = (ax_x - ARM, ax_y), (cx + UC_W / 2, cy)
            else:
                start, end = (ax_x + ARM, ax_y), (cx - UC_W / 2, cy)
            ax.plot([start[0], end[0]], [start[1], end[1]], color=colour,
                    lw=1.8, zorder=2)

    for cx, cy, name, ids, fill, _ in placed:
        draw_use_case(ax, cx, cy, name, ids, fill)

    for x, y, colour, label in ACTORS.values():
        draw_actor(ax, x, y, colour, label)

    # Legend, outside the system boundary.
    lx, ly = 1715, 1000
    ax.text(lx, ly, "Use case colour", fontsize=11, fontweight="bold",
            va="center")
    legend = [
        ("customer", "Customer only"),
        ("employee", "Bank Employee only"),
        ("admin", "Administrator only"),
        ("customer_employee", "Shared by two actors"),
        ("all", "All three actors"),
    ]
    for i, (fill, text) in enumerate(legend):
        y = ly + 45 + i * 42
        ax.add_patch(Ellipse((lx + 28, y), 52, 26, fc=FILL[fill],
                             ec="#2b2b2b", lw=1.2))
        ax.text(lx + 64, y, text, fontsize=10, va="center")

    fig.savefig(OUTPUT, dpi=150, facecolor="white")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
