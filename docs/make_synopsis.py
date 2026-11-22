"""Builds docs/PickMySeat-Synopsis-Shraddha-Desai-26MCA25.pdf (2 pages).

Run from the project folder:  python docs/make_synopsis.py
Needs:  pip install reportlab pillow   (uses Times New Roman from C:\\Windows\\Fonts)
"""
import os
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "PickMySeat-Synopsis-Shraddha-Desai-26MCA25.pdf")
LOGO = os.path.join(HERE, "brand", "logo-full-transparent.png")

F = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("TNR", os.path.join(F, "times.ttf")))
pdfmetrics.registerFont(TTFont("TNR-B", os.path.join(F, "timesbd.ttf")))
pdfmetrics.registerFont(TTFont("TNR-I", os.path.join(F, "timesi.ttf")))
pdfmetrics.registerFont(TTFont("TNR-BI", os.path.join(F, "timesbi.ttf")))
pdfmetrics.registerFontFamily("TNR", normal="TNR", bold="TNR-B", italic="TNR-I", boldItalic="TNR-BI")

INK, MUTED = colors.HexColor("#16161A"), colors.HexColor("#5b6070")
body = ParagraphStyle("body", fontName="TNR", fontSize=11, leading=14.2, textColor=INK, spaceAfter=3, alignment=4)
h2 = ParagraphStyle("h2", parent=body, fontName="TNR-B", fontSize=13, leading=16, spaceBefore=7, spaceAfter=3, alignment=0, keepWithNext=1)
title = ParagraphStyle("title", parent=body, fontName="TNR-B", fontSize=20, leading=23, spaceAfter=0, alignment=0)
sub = ParagraphStyle("sub", parent=body, fontSize=11.5, textColor=MUTED, spaceAfter=5, alignment=0)
cell = ParagraphStyle("cell", parent=body, fontSize=10, leading=12.5, spaceAfter=0, alignment=0)
cellb = ParagraphStyle("cellb", parent=cell, fontName="TNR-B")

S = []
P = lambda t, st=body: S.append(Paragraph(t, st))


def bullets(items, ordered=False):
    S.append(ListFlowable([ListItem(Paragraph(i, body), leftIndent=12) for i in items],
                          bulletType="1" if ordered else "bullet", bulletFormat="%s." if ordered else None,
                          start=1 if ordered else "•", leftIndent=14, bulletFontName="TNR", bulletFontSize=10))
    S.append(Spacer(1, 2))


def table(rows, widths, head=True):
    data = [[Paragraph(c, cellb if (head and r == 0) else cell) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths)
    st = [("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c9ccd6")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]
    if head:
        st.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3EEE5")))
    t.setStyle(TableStyle(st))
    S.append(t)
    S.append(Spacer(1, 4))


# ---------- header ----------
lw, lh = PILImage.open(LOGO).size
logo = Image(LOGO, width=58 * mm, height=58 * mm * lh / lw)
logo.hAlign = "LEFT"
S.append(logo)
P("Project Synopsis", title)
P("A movie ticket booking website and Android app with a walkable 3D cinema", sub)
table([["<b>Name</b>", "Shraddha Shridhar Desai", "<b>Roll No</b>", "26MCA25"],
       ["<b>Mentor</b>", "Ifrah Kampo Ma'am", "<b>Project</b>", "PickMySeat"]],
      [22 * mm, 64 * mm, 22 * mm, 62 * mm], head=False)

# ---------- 1 ----------
P("1. Introduction", h2)
P("PickMySeat is a movie ticket booking platform that lets customers see the real view of the screen from any seat before they book it. "
  "Seats are chosen on a familiar 2D seat map; tapping a seat moves the camera into a 3D model of that theatre at eye level in that seat, "
  "with the movie's trailer playing on the screen. The same code runs as a responsive website and as an Android app (APK).")

# ---------- 2 ----------
P("2. Problem statement and objectives", h2)
P("Booking apps show seats as a flat grid, so customers cannot judge the view, every theatre's layout looks alike, groups get split "
  "across aisles, and there is little confidence before paying. The objectives of PickMySeat are to:")
bullets([
    "Show the real view from any seat in an accurate 3D model of each theatre.",
    "Model real Mumbai multiplexes with their own sections, prices, aisles and seat types.",
    "Suggest the best seats for a group without crossing an aisle.",
    "Guarantee that one seat is never sold twice, and take payments through a real gateway in test mode.",
    "Serve both web and Android from one codebase.",
], ordered=True)

# ---------- 3 ----------
P("3. Key features", h2)
bullets([
    "<b>Home and catalogue:</b> a 3D ring of movie screens, five cities, eight films with key art and official trailers, a five-day date picker and theatre showtimes.",
    "<b>2D seat map:</b> priced sections, available / sold / bestseller / selected seats, and a \"best seats\" finder for the party size.",
    "<b>3D hall:</b> per-theatre layouts with eight seat types (classic to recliner and sofa), a wall-to-wall screen in IMAX or scope ratio, the trailer playing on it, 360° look, walking and camera presets.",
    "<b>Payment:</b> Razorpay Checkout in test mode with card, netbanking and wallet options.",
    "<b>Tickets:</b> a QR-code ticket with the booking and Razorpay payment IDs, saved under My tickets.",
])

# ---------- 4 ----------
P("4. Booking and payment flow", h2)
P("Movie → day, theatre and showtime → seats on the 2D map, checked in 3D → snacks → payment → ticket. "
  "At payment the server holds the seats for 10 minutes and creates a Razorpay order. Razorpay returns a signed result, "
  "and the server verifies its HMAC-SHA256 signature with the secret key before confirming the booking. "
  "Closing the payment window or letting the hold expire releases the seats for others.")

# ---------- 5 ----------
P("5. Technology stack", h2)
table([
    ["Layer", "Technology"],
    ["Website (frontend)", "Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand, qrcode; hosted on Vercel"],
    ["3D cinema hall", "Three.js with React Three Fiber and drei (WebGL)"],
    ["Android app", "Android APK built from the same web code with Android Studio, installed directly on the phone (no Play Store)"],
    ["Backend", "Node.js 24 REST API (built-in http module); payment routes also run as Vercel serverless functions"],
    ["Database", "SQLite through Node's built-in node:sqlite"],
    ["Payments", "Razorpay Checkout (test mode) with server-side HMAC-SHA256 verification"],
    ["Tools", "Git and GitHub, VS Code, node:test automatic tests"],
], [38 * mm, 132 * mm])

# ---------- 6 ----------
P("6. System design", h2)
P("PickMySeat uses a three-tier architecture: the presentation tier is the Next.js frontend shared by the website and the APK, "
  "the application tier is the Node.js REST API, and the data tier is the SQLite database with the tables movies, cities, theatres, "
  "snacks, bookings and booked_seats. Seat locking is enforced by a primary key on (show, seat) and a single database transaction, "
  "so either all seats in a booking are reserved or none are. One theatre layout definition drives the 2D map, the 3D hall, "
  "the best-seat logic and the pricing, so they always agree.")

# ---------- 7 ----------
P("7. Testing, limitations and future scope", h2)
P("Automatic API tests cover double booking, invalid input, a full payment, a forged signature, cancellation and an expired hold, "
  "and real Razorpay test payments were completed end to end. Current limits: sample movie data, no user accounts, and payments in test mode only. "
  "Future scope: user sign-in, live payments with refunds, a cloud PostgreSQL database, a theatre admin dashboard and accessibility options.")

# ---------- 8 ----------
P("8. Conclusion", h2)
P("PickMySeat turns seat selection from guesswork into a visual decision. A familiar 2D map keeps booking fast, an accurate 3D hall shows "
  "exactly what the customer is buying, and verified payments with database seat locking keep every booking safe, all from one codebase "
  "that serves both the website and the Android app.")


def footer(c, d):
    c.saveState()
    c.setFont("TNR", 9)
    c.setFillColor(MUTED)
    c.drawString(18 * mm, 10 * mm, "PickMySeat: Project Synopsis  |  Shraddha Shridhar Desai  |  26MCA25")
    c.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {d.page} of 2")
    c.restoreState()


SimpleDocTemplate(OUT, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=14 * mm, bottomMargin=17 * mm,
                  title="PickMySeat: Project Synopsis", author="Shraddha Shridhar Desai").build(S, onFirstPage=footer, onLaterPages=footer)
print("Saved", OUT)
