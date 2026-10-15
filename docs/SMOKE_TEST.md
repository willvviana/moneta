# Live-site smoke test

Run this after every deploy that changes behaviour, and once after the first deploy. It takes about ten minutes and checks what the automated tests cannot: the real Render service, Cloudflare in front of it, the real database and a real browser. Use a throwaway account, and a password from your password manager (never reuse one).

Service URL: https://moneta-x7wx.onrender.com (a free service sleeps after 15 minutes: the first request can take about a minute).

## 1. Server and security (no login needed)

| # | Check | Expected |
|---|---|---|
| 1 | Open `/health` | `{"status":"ok","db":"up"}` |
| 2 | Open `/budgets` directly (not by clicking) | The app loads (a login page, since you are signed out) |
| 3 | Open `/api/nope` | JSON `{"error":"Not found"}`, not a web page |
| 4 | Open `http://` (not https) version of the URL | Redirects to `https://` |
| 5 | Browser dev tools, Console, on any page | No red errors, no blocked-by-CSP messages |
| 6 | Dev tools, Network, click the document request | `Content-Security-Policy` and `Strict-Transport-Security` headers present; no `X-Powered-By` |

## 2. Account and session

| # | Check | Expected |
|---|---|---|
| 7 | Register a new account | You land on the dashboard |
| 8 | Dev tools, Application, Cookies | Cookie `sid` with `HttpOnly`, `Secure` and `SameSite=Lax` |
| 9 | Reload the page | Still signed in (the session survives) |
| 10 | Log out, then open `/budgets` | Redirected to the login page |
| 11 | Log in again with the same account | Works |
| 12 | Log in with a wrong password | "Invalid email or password"; the message is identical for an unknown email |
| 13 | Change the password (profile area or `/change-password`), then log in with the new one | Old password rejected, new one accepted, other sessions signed out |

## 3. The money features (the part that matters most)

| # | Check | Expected |
|---|---|---|
| 14 | Add a category "Groceries" | Appears in the list |
| 15 | Add an expense of $12.34 in it, today | Listed as $12.34; the dashboard expenses show $12.34 |
| 16 | Add an income of $100.00 | Income $100.00; net cash flow +$87.66 |
| 17 | Set a Groceries budget of $50.00 for this month | Shows spent $12.34, remaining $37.66 |
| 18 | Add a second Groceries expense of $40.00 | Budget turns over: remaining -$2.34 and is marked over budget |
| 19 | Edit the $40.00 expense to $10.00 | Budget and dashboard update; remaining $27.66 |
| 20 | Delete that expense | Totals drop accordingly |
| 21 | Reports, this month | Groceries total matches the dashboard expenses; the monthly totals row matches |
| 22 | Reload the page after each of the above once | The same numbers (they come from the database, not the browser) |

Money check: all amounts show exactly two decimals and nothing like `12.339999`.

## 4. Isolation (needs a second account)

| # | Check | Expected |
|---|---|---|
| 23 | Register a second account (private window) | Empty dashboard: none of the first account's data |
| 24 | In the first account's browser, note a transaction's id from the Network tab, then in the second account open `/api/transactions/<that id>` with a PATCH or DELETE (dev tools console `fetch`) | 404, and the first account's data is unchanged |

## 5. Layout and options

| # | Check | Expected |
|---|---|---|
| 25 | Resize to phone width | The menu folds; the footer links stay readable |
| 26 | Profile icon, Options: switch to light mode, change a colour and a font, reload | The choices persist; text stays readable in both modes |
| 27 | Click a nav link while scrolled down | The new page starts at the top |

## 6. Rate limits (do last: it locks your IP's login bucket for 15 minutes)

| # | Check | Expected |
|---|---|---|
| 28 | Eleven failed logins in a row | Ten "invalid" answers, then a "too many requests" answer |
| 29 | From a different network (phone on mobile data) try one login | The normal "invalid" answer, not "too many requests" |

If anything fails, write down the step number, what you saw, and the browser console or Render log lines around it.
