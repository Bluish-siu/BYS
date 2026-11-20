"""Builds docs/PickMySeat-Synopsis-Shraddha-Desai-26MCA25.pdf.

Run from the project folder:  python docs/make_synopsis.py
Needs:  pip install reportlab   (uses Times New Roman from C:\\Windows\\Fonts)
"""
import os
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

INK, MUTED = colors.HexColor("#1b1d27"), colors.HexColor("#5b6070")
body = ParagraphStyle("body", fontName="TNR", fontSize=12, leading=18, textColor=INK, spaceAfter=7, alignment=4)
h2 = ParagraphStyle("h2", parent=body, fontName="TNR-B", fontSize=15, leading=19, spaceBefore=14, spaceAfter=6, alignment=0, keepWithNext=1)
h3 = ParagraphStyle("h3", parent=body, fontName="TNR-B", fontSize=13, leading=17, spaceBefore=8, spaceAfter=3, alignment=0, keepWithNext=1)
title = ParagraphStyle("title", parent=body, fontName="TNR-B", fontSize=26, leading=30, spaceAfter=2, alignment=0)
sub = ParagraphStyle("sub", parent=body, fontSize=13, textColor=MUTED, spaceAfter=10, alignment=0)
cell = ParagraphStyle("cell", parent=body, fontSize=11, leading=14, spaceAfter=0, alignment=0)
cellb = ParagraphStyle("cellb", parent=cell, fontName="TNR-B")

S = []
P = lambda t, st=body: S.append(Paragraph(t, st))


def bullets(items, ordered=False):
    S.append(ListFlowable([ListItem(Paragraph(i, body), leftIndent=14) for i in items],
                          bulletType="1" if ordered else "bullet", bulletFormat="%s." if ordered else None,
                          start=1 if ordered else "•", leftIndent=16, bulletFontName="TNR", bulletFontSize=11))
    S.append(Spacer(1, 4))


def table(rows, widths, head=True):
    data = [[Paragraph(c, cellb if (head and r == 0) else cell) for c in row] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    st = [("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#c9ccd6")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]
    if head:
        st.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f2f6")))
    t.setStyle(TableStyle(st))
    S.append(t)
    S.append(Spacer(1, 8))


# ---------- cover ----------
from PIL import Image as PILImage
_lw, _lh = PILImage.open(LOGO).size
logo = Image(LOGO, width=75 * mm, height=75 * mm * _lh / _lw)
logo.hAlign = "LEFT"
S.append(logo)
S.append(Spacer(1, 8))
P("Project Synopsis", title)
P("A movie ticket booking website and Android app with a walkable 3D cinema", sub)
table([["<b>Name</b>", "Shraddha Shridhar Desai"], ["<b>Roll No</b>", "26MCA25"], ["<b>Mentor</b>", "Ifrah Kampo Ma'am"]],
      [32 * mm, 120 * mm], head=False)

# ---------- 1 ----------
P("1. Introduction", h2)
P("PickMySeat is a movie ticket booking platform that lets people walk into a 3D cinema hall and choose a seat by seeing the actual view of the screen from it. It runs as a responsive website and is packaged as an Android app (APK) from the same code.")
P("A customer picks a city, a movie, a theatre and a showtime. They then choose seats on a flat 2D seat map, the way they would on any booking app. When they tap a seat, the screen swoops into a 3D model of that theatre and lands at eye level in that exact seat. They can look around in 360 degrees, walk through the hall and watch the movie trailer play on the screen before paying.")
P("The vision is simple: nobody should buy a seat blind. PickMySeat turns seat selection from guesswork on a grid of boxes into a confident, visual decision.")
P("Movies and theatres are sample data. Payments run through Razorpay in test mode, so the full payment experience is real but no money is charged.")

# ---------- 2 ----------
P("2. Problem statement", h2)
P("Movie booking platforms have made buying a ticket quick, but choosing a seat is still blind. Customers face the same problems again and again:")
bullets([
    "<b>A flat grid hides the real view.</b> Seat G12 and seat N12 look identical on a map, yet one may sit too close to the screen and the other behind a row of recliners.",
    "<b>Layouts differ in every theatre.</b> Prime, recliner, sofa and lounger sections have different widths, prices and aisles, and a single generic grid cannot show that.",
    "<b>Group bookings go wrong.</b> Booking four seats together often splits the group across an aisle or leaves a single orphan seat.",
    "<b>Little confidence before paying.</b> People rarely see the film, the screen size or the room before they commit money.",
])
P("PickMySeat addresses these by pairing a familiar 2D seat map with an accurate 3D model of each theatre.")

# ---------- 3 ----------
P("3. Objectives", h2)
bullets([
    "Let a customer see the real view from any seat before booking it.",
    "Model each theatre with its own sections, prices, aisles and seat types, based on real Mumbai multiplexes.",
    "Keep the booking flow as fast as a conventional app: movie, showtime, seats, snacks, payment, ticket.",
    "Help groups sit together with a \"best seats\" suggestion that avoids aisles and sold seats.",
    "Guarantee that one seat can never be sold to two people, even when they pay at the same moment.",
    "Take payments through a real payment gateway (Razorpay, test mode) with server-side verification.",
    "Build one codebase that runs as a website and as an Android app.",
], ordered=True)

# ---------- 4 ----------
P("4. Website features", h2)
P("The website covers everything from discovering a movie to holding a ticket.")
bullets([
    "<b>Cinematic home screen.</b> A 3D ring of movie screens made from widescreen key art. Visitors drag to spin it, watch it rotate on its own and tap a screen to book.",
    "<b>City selection.</b> Mumbai, Pune, Chennai, Bengaluru and Hyderabad, each with its own theatres. The choice is remembered between visits.",
    "<b>Movie catalogue.</b> Eight films, including Ramayana, Avengers: Doomsday, Dune: Part Three and Eetha, each with key art and an official trailer.",
    "<b>Movie page.</b> A banner, a five-day date picker and a list of theatres with their showtimes, formats (such as IMAX, 4DX) and live seat availability.",
    "<b>Five theatres in Mumbai</b> modelled on real multiplexes: INOX R-City Ghatkopar, PVR ICON Palladium, Cinepolis Lake Shore Thane, Miraj IMAX Wadala and Maison INOX BKC.",
    "<b>Snacks.</b> Popcorn, drinks and combos can be added to the order.",
    "<b>My tickets.</b> Every booking is stored with a scannable QR code that can be reopened at any time.",
])

# ---------- 5 ----------
P("5. The 3D seat experience", h2)
P("This is the heart of PickMySeat. The seat page opens as a flat 2D map and turns into a walkable 3D cinema the moment a seat is chosen.")
P("2D seat map", h3)
bullets([
    "Sections are labelled with their price, with the screen at the bottom, as on familiar booking apps.",
    "Seats are shown as available, sold, bestseller or selected, and the map zooms to fit the phone or desktop screen.",
    "Seats bought by other customers are loaded from the server and shown as sold immediately.",
    "<b>Best seats</b> picks the best free seats together for the party size. It skips sold seats, never crosses an aisle and never splits a recliner pair.",
])
P("3D hall", h3)
bullets([
    "<b>Per-theatre layouts.</b> Each theatre has its own sections, prices, aisles and stadium-style rise. Seat types include classic, prime, plus, picture perfect, extra legroom, recliner, sofa and lounger.",
    "<b>Realistic room.</b> Slatted acoustic walls, dark carpet, light strips along the rake, aisle step lights and a ceiling that slopes down to the screen.",
    "<b>Wall-to-wall screen.</b> The screen follows real ratios, 1.9 to 1 for IMAX and 2.39 to 1 for scope, and fills the front wall.",
    "<b>Trailer on the screen.</b> The official trailer plays on the hall screen with a sound control. Seats in front block the picture just as they would in the room.",
])
P("Moving around", h3)
bullets([
    "<b>Seat view.</b> Choosing a seat glides the camera to eye height in that seat, with the lens set so the screen fills about 70 degrees of view.",
    "<b>Free look.</b> Drag to look in any direction, and walk with the keyboard or the on-screen direction buttons.",
    "<b>Camera presets.</b> Overview, From stage, Back row, Bird's eye, From my seat, Walk around and an automatic tour.",
])

# ---------- 6 ----------
P("6. Booking and payment flow", h2)
bullets([
    "<b>Choose a movie</b> from the home ring or the Now showing list.",
    "<b>Pick a day and a theatre</b> on the movie page, then a showtime.",
    "<b>Select seats</b> on the 2D map, check the view in 3D, and confirm.",
    "<b>Add snacks</b> if wanted.",
    "<b>Pay with Razorpay.</b> The server holds the seats for 10 minutes and creates a Razorpay order. The Razorpay Checkout window takes the payment by card, netbanking or wallet.",
    "<b>Verification.</b> Razorpay returns a signed result. The server checks the HMAC-SHA256 signature with its secret key and only then confirms the booking.",
    "<b>Receive the ticket.</b> A ticket with a QR code and the Razorpay payment ID is created and saved under My tickets.",
], ordered=True)
P("If the customer closes the payment window, or the 10 minutes pass, the held seats are released for others. Each section has its own price, for example ₹1,120 for classic rows and ₹2,770 for recliners at PVR ICON, plus a ₹30 convenience fee.")

# ---------- 7 ----------
P("7. Android app (APK)", h2)
P("The Android app is built with Capacitor, which packages the same Next.js code into a native Android application. The 3D hall, seat map, Razorpay payments and QR tickets work unchanged inside the app.")
bullets([
    "<b>One codebase.</b> A change made once reaches both the website and the app.",
    "<b>Native packaging.</b> App icon and splash screen from the PickMySeat logo, full-screen display and notch-safe layout.",
    "<b>Phone features.</b> Status bar, splash screen, haptics and share sheet through Capacitor plugins.",
    "<b>Distribution.</b> A debug APK is installed directly on the phone for demonstration. Store publishing is outside the scope of this project.",
])

# ---------- 8 ----------
P("8. Technology stack", h2)
P("Website", h3)
table([
    ["Layer", "Technology"],
    ["Framework and UI", "Next.js 14 (App Router), React 18, TypeScript"],
    ["Styling", "Tailwind CSS"],
    ["3D cinema hall", "Three.js, React Three Fiber, drei"],
    ["State", "Zustand (saved in the browser)"],
    ["Tickets and trailers", "qrcode, YouTube embed on the 3D screen"],
    ["Hosting", "Vercel"],
], [55 * mm, 117 * mm])
P("Android app", h3)
table([
    ["Layer", "Technology"],
    ["Hybrid app framework", "Capacitor"],
    ["App screens", "The same Next.js and React code, exported as static files"],
    ["Build tools", "Android Studio, Android SDK, Gradle, Java JDK"],
    ["Output", "Debug APK installed on an Android phone"],
], [55 * mm, 117 * mm])
P("Shared by both", h3)
table([
    ["Layer", "Technology"],
    ["Backend", "Node.js 24 REST API on the built-in http module"],
    ["Database", "SQLite through Node's built-in node:sqlite"],
    ["Payments", "Razorpay Checkout (test mode) with HMAC-SHA256 verification"],
    ["Testing", "node:test automatic API tests"],
    ["Version control", "Git and GitHub"],
], [55 * mm, 117 * mm])

# ---------- 9 ----------
P("9. System design", h2)
P("PickMySeat follows a three-tier architecture. The presentation tier is the Next.js frontend, used by both the website and the Android app. The application tier is the Node.js REST API. The data tier is the SQLite database.")
table([
    ["Folder", "Contents"],
    ["frontend/", "Pages, 3D hall, 2D seat map, posters, booking store and API client"],
    ["backend/", "REST API, booking and payment logic, Razorpay client, tests"],
    ["database/", "schema.sql (tables), seed.sql (movies, theatres, snacks)"],
    ["docs/", "Synopsis and logo files"],
], [38 * mm, 134 * mm])
P("<b>Database tables.</b> movies, cities, theatres, snacks, bookings and booked_seats. Each booking stores the show, seats, total, status, Razorpay order ID and payment ID.")
P("<b>Seat locking.</b> booked_seats has a primary key on (show, seat), and seats are reserved inside one database transaction. Either every seat in a booking is reserved, or none are, so the same seat can never be sold twice.")
P("<b>Seat layout model.</b> A theatre layout is built from a short definition of sections, prices, seat types, rows, aisle gaps and stadium rise. The same layout feeds the 2D map, the 3D hall, the best-seats logic and the pricing.")
P("<b>3D performance.</b> Seats of the same type are merged into one shape and drawn together, which keeps hundreds of seats smooth. Textures such as carpet and wall panels are generated in code.")

# ---------- 10 ----------
P("10. Testing and deployment", h2)
bullets([
    "<b>Automatic tests</b> cover the catalogue, double-booking protection, bad input, a full Razorpay payment, a forged signature, a cancelled payment and an expired seat hold.",
    "<b>End-to-end test</b> of a real Razorpay test payment confirmed the booking in the database and issued the QR ticket.",
    "<b>Source code</b> is on GitHub. The website is hosted on Vercel and redeploys on every push.",
])

# ---------- 11 ----------
P("11. Limitations and future scope", h2)
P("Current limitations", h3)
bullets([
    "Movies, theatres and showtimes are sample data, and payments run in Razorpay test mode only.",
    "There are no user accounts yet. Tickets are saved on the device.",
    "The booking amount is calculated in the frontend. A production system should recalculate it on the server.",
    "The 3D hall needs a reasonably modern phone or computer.",
])
P("Future scope", h3)
bullets([
    "<b>User accounts</b> with phone OTP sign-in and booking history across devices.",
    "<b>Live payments</b> after Razorpay KYC, with refunds and cancellation.",
    "<b>Cloud deployment</b> of the backend with a PostgreSQL database.",
    "<b>Theatre dashboard</b> so cinemas can manage shows, prices and layouts.",
    "<b>Store release</b> of the Android app, and an iPhone version.",
    "<b>Accessibility options</b> such as wheelchair spaces and screen reader support.",
], ordered=True)

# ---------- 12 ----------
P("12. Conclusion", h2)
P("PickMySeat shows that seat selection can be a visual, confident experience instead of a guess. A familiar 2D map keeps booking fast, an accurate 3D hall with a playing trailer lets customers see exactly what they are buying, and a verified Razorpay payment with database seat locking makes every booking safe. Because the website and the Android app share one codebase, the project can grow into a full product by adding accounts, cloud hosting and live payments.")


def footer(c, d):
    c.saveState()
    c.setFont("TNR", 9)
    c.setFillColor(MUTED)
    c.drawString(20 * mm, 11 * mm, "PickMySeat: Project Synopsis  |  Shraddha Shridhar Desai  |  26MCA25")
    c.drawRightString(A4[0] - 20 * mm, 11 * mm, f"Page {d.page}")
    c.restoreState()


SimpleDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=20 * mm,
                  title="PickMySeat: Project Synopsis", author="Shraddha Shridhar Desai").build(S, onFirstPage=footer, onLaterPages=footer)
print("Saved", OUT)
