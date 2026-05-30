# Web Frontend User Guide (AIoT Asset Platform)

This guide explains how end users use the web dashboard in `apps/web`.

## Accessing the Application

1. Open the web app URL in your browser.
2. If you do not have an account, select **Create a new account** on the login page.
3. Sign in with your email and password.

## Account Registration

On the registration page:

1. Enter first name and last name (optional fields).
2. Enter a valid email address.
3. Enter a password (minimum 6 characters).
4. Review password strength feedback.
5. Click **Create account**.

## Login

On the login page:

1. Enter your email and password.
2. Click **Sign in**.
3. On success, you are redirected to the dashboard overview.

If login fails, an error message is shown at the top of the form.

## Dashboard Overview

The **Overview** tab shows a high-level snapshot of your assets:

- Total number of assets
- Portfolio value and depreciation metrics
- Asset distribution by category and location
- Recent purchases
- Warranty items nearing expiry
- Portfolio value trend

Use top navigation to switch between:

- **Overview**
- **Assets**
- **Reports**
- **Settings**

## Assets Page

The **Assets** tab provides inventory management and filtering.

### Available table actions

- Search assets by name/brand/model/category/location.
- Filter by category.
- Filter by location.
- Sort by columns such as name, purchase price, and purchase date.
- Select rows with checkboxes.
- Open an asset detail page by clicking a row.

### Export options

- Export table data as CSV.
- Export table data as Excel (`.xlsx`).
- Generate an insurance report PDF.

### Refresh

Use **Refresh** to reload asset data from the backend.

## Asset Detail Page

From the Assets table, open an item to view:

- Name, category, and condition
- Brand/model/serial information
- Purchase price and purchase date
- Depreciated value
- Location and warranty expiry
- Notes
- Attached photos

Use **Back to Assets** to return to the list.

## Reports Page

The **Reports** tab currently supports insurance report generation.

1. Optional: choose one or more categories to filter included assets.
2. Click **Generate PDF**.
3. The file downloads with a date-based filename.

The page also shows:

- Estimated portfolio value
- Last generated timestamp

## Settings Page

The **Settings** page has two tabs:

- **Profile**: shows email, first name, last name, and role (read-only currently).
- **Security**: includes active session info and sign-out action. Password change is marked coming soon.

## Logout

You can sign out from:

- Top navigation bar on dashboard pages
- Settings security tab

After logout, protected routes redirect back to login.

## Troubleshooting

- If a page fails to load data, use the provided **Retry** or **Refresh** actions.
- If your session expires, sign in again.
- If report generation fails, check backend availability and try again.
