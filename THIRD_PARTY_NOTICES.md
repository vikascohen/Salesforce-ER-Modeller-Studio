# Third-Party Notices

This project bundles the following third-party library as a Salesforce
Static Resource:

## SheetJS Community Edition (`xlsx`)

- **Used for:** generating real multi-sheet `.xlsx` files client-side in
  the Data Dictionary's Export to Excel feature (Salesforce has no native
  way to produce `.xlsx` files from an LWC — CSV has no concept of
  multiple sheets/tabs, which the "Export All" feature needs).
- **Location in this repo:** `force-app/main/default/staticresources/sheetjs.js`
- **Version:** 0.18.5
- **License:** Apache License 2.0
- **Source:** https://www.npmjs.com/package/xlsx
- **Full license text:** https://www.apache.org/licenses/LICENSE-2.0

Apache-2.0 is a permissive license compatible with this project's own MIT
license — bundling it doesn't change the license of this project's own
code, only requires this attribution.
