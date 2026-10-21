# DIU Holiday & Overtime Review — Trial System

A separate, trial version of the overtime portal. It does **not** touch the live portal or the September 2026 spreadsheet.

- **Supervisor portal** (`/`): sign in with a one-time email code, see only your own employees, review day by day, print, submit or update.
- **Admin panel** (`/#/admin`): months, attendance uploads, office schedule, Maintenance list, approvals, reviewers and delegates, emails and progress, bill, access, activity log.
- **Backend**: one Google Apps Script file (`google-apps-script/Code.gs`) that keeps everything in Google Sheets owned by the HR Workspace account: one master spreadsheet plus one spreadsheet per month.

## Set up (about 15 minutes, once)

### 1. Backend (Google Apps Script) — signed in as hroffice8@daffodilvarsity.edu.bd
1. Go to <https://script.google.com> → **New project**. Name it `DIU OT Trial backend`.
2. Delete the sample code in `Code.gs`, then paste the whole content of [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
3. Project Settings (gear icon) → Time zone: **(GMT+06:00) Dhaka**.
4. Back in the editor, choose the function **SETUP** in the toolbar and press **Run**. Allow the permissions Google asks for
   (Sheets, Drive, sending email, reading the mailbox for bounced emails, and running a daily job).
   It creates the folder **“DIU OT Trial”** in your Drive with the master spreadsheet and sub-folders.
5. **Deploy → New deployment** → type **Web app** → *Execute as*: **Me** → *Who has access*: **Anyone** → **Deploy**.
   Copy the **Web app URL** (ends with `/exec`).

### 2. Portal (Vercel)
1. In Vercel: **Add New → Project** → import `hroffice8-diuot-trial`.
2. Under **Environment Variables** add `VITE_API_URL` = the Web app URL from step 1.5. Deploy.
3. Open `https://<your-vercel-address>/#/admin` and sign in with hroffice8@daffodilvarsity.edu.bd.
4. **Rates & settings → General settings**: set *Review portal address* to your Vercel address.

> **Trial safety:** the setting *testEmailRedirect* is filled with your own address. While it is set, every invitation,
> reminder and confirmation goes to you (the subject shows who it was meant for). Clear it only when going live.

## Load September 2026 to compare with the old bill
In the admin panel, in this order:
1. **Employees & reviewers → Update from HRIS**: the *Employee common info* Excel from HRIS.
2. **Employees & reviewers → Update grades & gross salary**: `1 Grade and Salary Info.xlsx` (tick *add them to the employee list*).
3. **Approvals → Bulk upload**: `2 Approvals from your current sheet.xlsx` (its *Please check* tab lists rows to review).
4. **Months → Open a new month**: September 2026.
5. **Attendance**: both HRIS Overtime Sheet files together.
6. **Maintenance list**: `3 Maintenance list September 2026.xlsx`.
7. **Attendance → Trial only: import reviews from the old portal**: the old September spreadsheet downloaded as Excel.
8. **Bill**: compare with the old bill.

## Monthly routine (after going live)
Open new month → upload the two HRIS files → check office schedule → upload the Maintenance list → *Open for supervisors* →
send invitations → watch progress (automatic reminders before the deadline) → close month → download / print the bill →
mark as disbursed (locks a copy).

## Rules the bill follows
- An employee is paid only if **eligible** (an approval covers the month) **and reviewed** by their supervisor or an approved delegate.
- Workday OT counts when the employee worked at least shift + 1 hour; OT = worked − shift, capped by the approval
  (1:00 / 1:30 / 2:00 / 3:00 / 4:00 …). Weekday limits, “N days a week” and monthly limits (e.g. 90 hours) come from the approval.
- Weekend/holiday: working the scheduled shift = 1 full day = 8 bill hours (a 6:30 Ramadan shift also counts as a full day); less is paid pro rata.
- A holiday on the employee’s weekend counts for staff with weekend permission (the Friday-holiday rule).
- Security staff with the *security bonus*: on special-schedule workdays OT cap = usual cap + (8 h − shift).
- Late rule per month: “count late days” (default) or “late days get no OT” (workdays only).
- The lower of supervisor and attendance figures is paid (per month total, or day by day — a month setting).
- Holiday and OT amounts are rounded to whole Taka per employee; the total and the amount in words use those.

## Developer notes
- Backend sources are in `google-apps-script/src/`; run `npm run build:gas` to rebuild `Code.gs`.
- `tools/gas-mock.mjs` runs the backend in Node with an in-memory stand-in for Google services (used for testing with real data).
- Frontend: React + Vite + Tailwind. `npm install && npm run dev`.
